import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EyeExamAuditAction, Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { colorRequiredHeaderAsterisks } from '../common/excel-required-headers';
import { normalizePhone } from '../customers/phone.util';
import { PrismaService } from '../prisma/prisma.service';
import { EyeExamQueryDto } from './dto/eye-exam-query.dto';
import { eyeExamOrderBy } from './eye-exam-sort';

const MAX_IMPORT_ROWS = 1_000;
const HEADERS = ['Số điện thoại khách hàng*', 'Ngày đo*', 'SPH MP', 'CYL MP', 'AXIS MP', 'ADD MP', 'PD MP', 'PRISM MP', 'BASE MP', 'Cao lắp MP', 'SPH MT', 'CYL MT', 'AXIS MT', 'ADD MT', 'PD MT', 'PRISM MT', 'BASE MT', 'Cao lắp MT', 'PD tổng', 'Nhu cầu đeo', 'Thiết kế tròng', 'Không kê đơn', 'Lý do không kê đơn', 'Ghi chú'];
const IMPORT_HEADERS = ['Mã phiếu', ...HEADERS];
const EXPORT_HEADERS = ['Mã phiếu', ...HEADERS, 'Trạng thái'];
type Key = 'code' | 'phone' | 'examDate' | 'rSph' | 'rCyl' | 'rAxis' | 'rAdd' | 'rPd' | 'rPrism' | 'rBase' | 'rSegHeight' | 'lSph' | 'lCyl' | 'lAxis' | 'lAdd' | 'lPd' | 'lPrism' | 'lBase' | 'lSegHeight' | 'pdTotal' | 'wearingPurpose' | 'lensDesign' | 'noPrescription' | 'noPrescriptionReason' | 'note';
type Columns = Record<Key, number | undefined>;
export interface EyeExamImportRow { row: number; code?: string; phone: string; examDate: string; rSph?: number; rCyl?: number; rAxis?: number; rAdd?: number; rPd?: number; rPrism?: number; rBase?: string; rSegHeight?: number; lSph?: number; lCyl?: number; lAxis?: number; lAdd?: number; lPd?: number; lPrism?: number; lBase?: string; lSegHeight?: number; pdTotal?: number; wearingPurpose?: string; lensDesign?: string; noPrescription: boolean; noPrescriptionReason?: string; note?: string; }
export interface EyeExamImportIssue { row: number; reason: string; kind?: 'existing'; }
export interface EyeExamImportPreview { total: number; validRows: EyeExamImportRow[]; issues: EyeExamImportIssue[]; }

@Injectable()
export class EyeExamExcelService {
  constructor(private readonly prisma: PrismaService) {}

  async createTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Phiếu đo mắt', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [18, 14, ...Array(16).fill({ width: 12 }), { width: 12 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 28 }, { width: 42 }];
    sheet.addRow(HEADERS);
    for (let index = 0; index < 10; index += 1) sheet.addRow(Array(HEADERS.length).fill(null));
    this.formatGrid(sheet, HEADERS.length, 11);
    colorRequiredHeaderAsterisks(sheet, HEADERS);
    sheet.getColumn(2).numFmt = '@';
    for (let row = 2; row <= 11; row += 1) sheet.getCell(row, 2).numFmt = '@';
    const guide = workbook.addWorksheet('Hướng dẫn');
    guide.columns = [{ width: 118 }];
    ['Hướng dẫn nhập phiếu đo mắt', 'File đã xuất có Mã phiếu: phiếu đã có được bỏ qua. File mẫu không có mã: mỗi dòng hợp lệ tạo một phiếu nháp mới, kể cả cùng khách hàng và ngày đo. Hệ thống không ghi đè hoặc tự chốt phiếu.', 'Khách hàng phải có sẵn trong hệ thống; dùng số điện thoại để đối chiếu.', 'Cột có dấu * là bắt buộc. Ngày đo nhập dạng dd/mm/yyyy (ví dụ 04/11/2026 là ngày 4 tháng 11) hoặc yyyy-mm-dd. Các số khúc xạ nhập theo đơn vị diop; AXIS từ 0 đến 180; PD và cao lắp tính bằng mm.', 'Nhu cầu đeo: Xa, Gần, Trung gian, Đa dụng. Thiết kế tròng: Đơn tròng, Hai tròng, Đa tròng. BASE: BI, BO, BU hoặc BD.', `Tối đa ${MAX_IMPORT_ROWS.toLocaleString('vi-VN')} phiếu mỗi lần nhập. Luôn xem trước các dòng lỗi trước khi xác nhận.`].forEach((value) => guide.addRow([value]));
    guide.getRow(1).font = { bold: true, size: 14 };
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async export(query: EyeExamQueryDto & { ids?: string[] }): Promise<Buffer> {
    const q = query.q?.trim();
    const where: Prisma.EyeExamWhereInput = {
      archivedAt: null,
      ...(query.ids?.length ? { id: { in: query.ids } } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.dateFrom || query.dateTo ? { examDate: { ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}), ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}) } } : {}),
      ...(query.status === 'LOCKED' ? { lockedAt: { not: null } } : query.status === 'DRAFT' ? { lockedAt: null } : {}),
      customer: { deletedAt: null },
      ...(q ? { OR: [{ code: { contains: q, mode: 'insensitive' } }, { customer: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: normalizePhone(q) } }] } }] } : {}),
    };
    const exams = await this.prisma.eyeExam.findMany({ where, orderBy: eyeExamOrderBy(query.sortBy, query.sortDirection), include: { customer: { select: { phone: true } } } });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Phiếu đo mắt', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [{ width: 28 }, { width: 18 }, { width: 14 }, ...Array(16).fill({ width: 12 }), { width: 12 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 28 }, { width: 42 }, { width: 14 }];
    sheet.addRow(EXPORT_HEADERS);
    exams.forEach((exam) => sheet.addRow([exam.code, exam.customer.phone, this.excelDate(exam.examDate), this.excelNumber(exam.rSph), this.excelNumber(exam.rCyl), exam.rAxis, this.excelNumber(exam.rAdd), this.excelNumber(exam.rPd), this.excelNumber(exam.rPrism), exam.rBase, this.excelNumber(exam.rSegHeight), this.excelNumber(exam.lSph), this.excelNumber(exam.lCyl), exam.lAxis, this.excelNumber(exam.lAdd), this.excelNumber(exam.lPd), this.excelNumber(exam.lPrism), exam.lBase, this.excelNumber(exam.lSegHeight), this.excelNumber(exam.pdTotal), this.purposeLabel(exam.wearingPurpose), this.designLabel(exam.lensDesign), exam.noPrescription ? 'Có' : 'Không', exam.noPrescriptionReason, exam.note, exam.lockedAt ? 'Đã chốt' : 'Bản nháp']));
    this.formatGrid(sheet, EXPORT_HEADERS.length, exams.length + 1);
    colorRequiredHeaderAsterisks(sheet, EXPORT_HEADERS);
    sheet.getColumn(3).numFmt = '@';
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async preview(file: Buffer): Promise<EyeExamImportPreview> {
    let workbook: XLSX.WorkBook;
    try { workbook = XLSX.read(file, { type: 'buffer', cellDates: true }); } catch { throw new BadRequestException('Không thể đọc file Excel. Vui lòng dùng file .xlsx hợp lệ.'); }
    const first = workbook.SheetNames[0];
    if (!first) throw new BadRequestException('File Excel không có trang dữ liệu.');
    const values = XLSX.utils.sheet_to_json(workbook.Sheets[first], { header: 1, defval: '', raw: true }) as unknown[][];
    if (values.length < 2) return { total: 0, validRows: [], issues: [] };
    const columns = this.findColumns(values[0] ?? []);
    if (columns.code === undefined && (values[0] ?? []).some((header) => this.header(header) === 'id phieu')) throw new BadRequestException('File xuất cũ dùng ID phiếu. Hãy xuất lại file có cột Mã phiếu để đối chiếu trùng, hoặc dùng file mẫu nếu muốn tạo phiếu mới.');
    if (columns.phone === undefined || columns.examDate === undefined) throw new BadRequestException('Thiếu cột “Số điện thoại khách hàng” hoặc “Ngày đo”. Hãy dùng file mẫu để nhập.');
    const rows = values.slice(1).filter((row) => row.some((cell) => this.text(cell)));
    if (rows.length > MAX_IMPORT_ROWS) throw new BadRequestException(`Mỗi lần chỉ có thể nhập tối đa ${MAX_IMPORT_ROWS.toLocaleString('vi-VN')} phiếu đo.`);
    const validRows: EyeExamImportRow[] = []; const issues: EyeExamImportIssue[] = []; const codes = new Set<string>();
    rows.forEach((row, index) => { const result = this.readRow(row, index + 2, columns, codes); if ('reason' in result) issues.push(result); else { if (result.code) codes.add(result.code); validRows.push(result); } });
    const existing = codes.size ? await this.prisma.eyeExam.findMany({ where: { code: { in: [...codes] } }, select: { code: true } }) : [];
    const existingCodes = new Set(existing.map((exam) => exam.code));
    for (const row of validRows) if (row.code && existingCodes.has(row.code)) issues.push({ row: row.row, reason: `Mã phiếu ${row.code} đã tồn tại trong hệ thống; không tạo bản nháp mới.`, kind: 'existing' });
    const newRows = validRows.filter((row) => !row.code || !existingCodes.has(row.code));
    const phones = [...new Set(newRows.map((row) => row.phone))];
    const customers = phones.length ? await this.prisma.customer.findMany({ where: { phone: { in: phones }, deletedAt: null }, select: { phone: true } }) : [];
    const customerPhones = new Set(customers.map((customer) => customer.phone));
    for (const row of newRows) if (!customerPhones.has(row.phone)) issues.push({ row: row.row, reason: `Không tìm thấy khách hàng có số điện thoại ${row.phone}. Hãy tạo khách hàng trước khi nhập phiếu đo.` });
    return { total: rows.length, validRows: newRows.filter((row) => customerPhones.has(row.phone)), issues: issues.sort((a, b) => a.row - b.row) };
  }

  async importRows(rows: EyeExamImportRow[], createdById: string): Promise<{ created: number; skipped: number }> {
    if (!rows.length || rows.length > MAX_IMPORT_ROWS) throw new BadRequestException('Số dòng nhập không hợp lệ.');
    const codes = new Set<string>();
    const cleaned = rows.map((row, index) => {
      const cleanedRow = this.readSubmittedRow(row, index + 1, codes);
      if (cleanedRow.code) codes.add(cleanedRow.code);
      return cleanedRow;
    });
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = codes.size ? await transaction.eyeExam.findMany({ where: { code: { in: [...codes] } }, select: { code: true } }) : [];
        const existingCodes = new Set(existing.map((exam) => exam.code));
        const pending = cleaned.filter((row) => !row.code || !existingCodes.has(row.code));
        if (!pending.length) return { created: 0, skipped: cleaned.length };
        const customers = await transaction.customer.findMany({ where: { phone: { in: [...new Set(pending.map((row) => row.phone))] }, deletedAt: null }, select: { id: true, phone: true } });
        const customerIds = new Map(customers.map((customer) => [customer.phone, customer.id]));
        const missing = pending.find((row) => !customerIds.has(row.phone));
        if (missing) throw new BadRequestException(`Không tìm thấy khách hàng có số điện thoại ${missing.phone} ở dòng ${missing.row}. Hãy tạo khách hàng trước khi nhập phiếu đo.`);
        // Reserve codes from exported files before generating codes for template rows.
        for (const row of [...pending].sort((a, b) => Number(Boolean(b.code)) - Number(Boolean(a.code)))) {
          const exam = await transaction.eyeExam.create({ data: { ...this.toData(row), customerId: customerIds.get(row.phone)! } });
          await transaction.eyeExamAuditLog.create({ data: { eyeExamId: exam.id, action: EyeExamAuditAction.CREATED, changes: { source: 'EXCEL_IMPORT', row: row.row }, createdById } });
        }
        return { created: pending.length, skipped: cleaned.length - pending.length };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Mã phiếu vừa được nhập trong một yêu cầu khác. Vui lòng xem trước file lại.');
      throw error;
    }
  }

  private readSubmittedRow(row: EyeExamImportRow, fallback: number, codes: Set<string>): EyeExamImportRow { const result = this.readRow(this.toRawRow(row), row.row ?? fallback, this.findColumns(IMPORT_HEADERS), codes); if ('reason' in result) throw new BadRequestException(`Dữ liệu phiếu đo ở dòng ${result.row} không hợp lệ: ${result.reason}`); return result; }
  private toRawRow(row: EyeExamImportRow): unknown[] { return [row.code, row.phone, row.examDate, row.rSph, row.rCyl, row.rAxis, row.rAdd, row.rPd, row.rPrism, row.rBase, row.rSegHeight, row.lSph, row.lCyl, row.lAxis, row.lAdd, row.lPd, row.lPrism, row.lBase, row.lSegHeight, row.pdTotal, row.wearingPurpose, row.lensDesign, row.noPrescription, row.noPrescriptionReason, row.note]; }
  private readRow(row: unknown[], spreadsheetRow: number, columns: Columns, codes: Set<string>): EyeExamImportRow | EyeExamImportIssue {
    const code = columns.code === undefined ? '' : this.text(row[columns.code]).toUpperCase();
    if (code && !/^[A-Z0-9][A-Z0-9-]{0,39}$/.test(code)) return { row: spreadsheetRow, reason: 'Mã phiếu không hợp lệ (tối đa 40 ký tự, chỉ gồm chữ, số và dấu gạch ngang).' };
    if (code && codes.has(code)) return { row: spreadsheetRow, reason: `Mã phiếu ${code} bị lặp trong file.` };
    const phone = normalizePhone(this.text(row[columns.phone!])); const examDate = this.parseDate(row[columns.examDate!]);
    if (!/^0\d{9,10}$/.test(phone)) return { row: spreadsheetRow, reason: 'Số điện thoại khách hàng không hợp lệ.' };
    if (!examDate) return { row: spreadsheetRow, reason: 'Ngày đo không hợp lệ.' };
    const numeric = (key: Key, min: number, max: number, quarter = false): number | undefined | string => { const value = row[columns[key]!]; if (!this.text(value)) return undefined; const number = Number(typeof value === 'string' ? value.trim().replace(/^"(-?\d+(?:\.\d+)?)"$/, '$1') : value); return Number.isFinite(number) && number >= min && number <= max && (!quarter || Math.round(number * 4) === number * 4) ? number : 'invalid'; };
    const fields: Record<string, unknown> = {};
    for (const [key, min, max, quarter] of [['rSph', -30, 30, true], ['rCyl', -30, 30, true], ['rAxis', 0, 180, false], ['rAdd', 0, 4, true], ['rPd', 20, 80, false], ['rPrism', 0, 20, true], ['rSegHeight', 5, 50, false], ['lSph', -30, 30, true], ['lCyl', -30, 30, true], ['lAxis', 0, 180, false], ['lAdd', 0, 4, true], ['lPd', 20, 80, false], ['lPrism', 0, 20, true], ['lSegHeight', 5, 50, false], ['pdTotal', 40, 80, false]] as const) { const value = numeric(key, min, max, quarter); if (value === 'invalid') return { row: spreadsheetRow, reason: `${key} không hợp lệ.` }; fields[key] = value; }
    const rBase = this.base(row[columns.rBase!]); const lBase = this.base(row[columns.lBase!]); if (rBase === 'invalid' || lBase === 'invalid') return { row: spreadsheetRow, reason: 'BASE chỉ có thể là BI, BO, BU hoặc BD.' };
    const noPrescription = this.boolean(row[columns.noPrescription!]); if (noPrescription === undefined) return { row: spreadsheetRow, reason: 'Không kê đơn chỉ có thể là Có hoặc Không.' };
    const wearingPurpose = this.purpose(row[columns.wearingPurpose!]); const lensDesign = this.design(row[columns.lensDesign!]); if (wearingPurpose === 'invalid' || lensDesign === 'invalid') return { row: spreadsheetRow, reason: 'Nhu cầu đeo hoặc thiết kế tròng không hợp lệ.' };
    const noPrescriptionReason = this.text(row[columns.noPrescriptionReason!]); const note = this.text(row[columns.note!]);
    if (noPrescription && !noPrescriptionReason) return { row: spreadsheetRow, reason: 'Cần nêu lý do khi chọn không kê đơn.' }; if (noPrescription && Object.values(fields).some((value) => value !== undefined)) return { row: spreadsheetRow, reason: 'Phiếu không kê đơn không thể có thông số khúc xạ.' }; if (noPrescriptionReason.length > 500 || note.length > 2_000) return { row: spreadsheetRow, reason: 'Lý do hoặc ghi chú vượt quá độ dài cho phép.' };
    return { row: spreadsheetRow, ...(code ? { code } : {}), phone, examDate, ...(fields as Omit<EyeExamImportRow, 'row' | 'code' | 'phone' | 'examDate' | 'noPrescription'>), rBase: rBase || undefined, lBase: lBase || undefined, noPrescription, noPrescriptionReason: noPrescriptionReason || undefined, note: note || undefined, wearingPurpose: wearingPurpose || undefined, lensDesign: lensDesign || undefined };
  }
  private toData(row: EyeExamImportRow): Omit<Prisma.EyeExamUncheckedCreateInput, 'customerId'> { const data = Object.fromEntries(Object.entries(row).filter(([key]) => !['row', 'phone', 'examDate'].includes(key))) as Omit<EyeExamImportRow, 'row' | 'phone' | 'examDate'>; return { ...data, examDate: new Date(`${row.examDate}T00:00:00.000Z`), noPrescription: row.noPrescription, noPrescriptionReason: row.noPrescriptionReason ?? null, note: row.note ?? null, wearingPurpose: row.wearingPurpose ?? null, lensDesign: row.lensDesign ?? null }; }
  private findColumns(headers: unknown[]): Columns { const aliases: Record<string, Key> = { 'ma phieu': 'code', 'so dien thoai khach hang': 'phone', 'so dien thoai': 'phone', 'ngay do': 'examDate', 'sph mp': 'rSph', 'cyl mp': 'rCyl', 'axis mp': 'rAxis', 'add mp': 'rAdd', 'pd mp': 'rPd', 'prism mp': 'rPrism', 'base mp': 'rBase', 'cao lap mp': 'rSegHeight', 'sph mt': 'lSph', 'cyl mt': 'lCyl', 'axis mt': 'lAxis', 'add mt': 'lAdd', 'pd mt': 'lPd', 'prism mt': 'lPrism', 'base mt': 'lBase', 'cao lap mt': 'lSegHeight', 'pd tong': 'pdTotal', 'nhu cau deo': 'wearingPurpose', 'thiet ke trong': 'lensDesign', 'khong ke don': 'noPrescription', 'ly do khong ke don': 'noPrescriptionReason', 'ghi chu': 'note' }; const columns = {} as Columns; headers.forEach((header, index) => { const key = aliases[this.header(header)]; if (key && columns[key] === undefined) columns[key] = index; }); return columns; }
  private formatGrid(sheet: ExcelJS.Worksheet, columns: number, rows: number): void { for (let r = 1; r <= rows; r += 1) { const row = sheet.getRow(r); row.height = r === 1 ? 23 : 20; for (let c = 1; c <= columns; c += 1) { const cell = row.getCell(c); cell.border = { top: { style: 'thin', color: { argb: 'FF000000' } }, left: { style: 'thin', color: { argb: 'FF000000' } }, bottom: { style: 'thin', color: { argb: 'FF000000' } }, right: { style: 'thin', color: { argb: 'FF000000' } } }; cell.alignment = { vertical: 'middle', wrapText: true }; if (r === 1) cell.font = { bold: true, color: { argb: 'FF000000' } }; } } sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(rows, 1), column: columns } }; }
  private parseDate(value: unknown): string | undefined { if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10); if (typeof value === 'number') { const date = XLSX.SSF.parse_date_code(value); return date ? `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}` : undefined; } const input = this.text(value); const vietnamese = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); const iso = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (!vietnamese && !iso) return undefined; const [year, month, day] = vietnamese ? [Number(vietnamese[3]), Number(vietnamese[2]), Number(vietnamese[1])] : [Number(iso![1]), Number(iso![2]), Number(iso![3])]; const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : undefined; }
  private base(value: unknown): string | undefined | 'invalid' { const input = this.header(value).toUpperCase(); return !input ? undefined : ['BI', 'BO', 'BU', 'BD'].includes(input) ? input : 'invalid'; }
  private boolean(value: unknown): boolean | undefined { const input = this.header(value); return !input || ['khong', 'false', '0', 'no'].includes(input) ? false : ['co', 'true', '1', 'yes'].includes(input) ? true : undefined; }
  private purpose(value: unknown): string | undefined | 'invalid' { const input = this.header(value); return !input ? undefined : ['xa', 'distance'].includes(input) ? 'DISTANCE' : ['gan', 'near'].includes(input) ? 'NEAR' : ['trung gian', 'intermediate'].includes(input) ? 'INTERMEDIATE' : ['da dung', 'multipurpose'].includes(input) ? 'MULTIPURPOSE' : 'invalid'; }
  private design(value: unknown): string | undefined | 'invalid' { const input = this.header(value); return !input ? undefined : ['don trong', 'single vision', 'single_vision'].includes(input) ? 'SINGLE_VISION' : ['hai trong', 'bifocal'].includes(input) ? 'BIFOCAL' : ['da trong', 'progressive'].includes(input) ? 'PROGRESSIVE' : 'invalid'; }
  private purposeLabel(value: string | null): string { return value === 'DISTANCE' ? 'Xa' : value === 'NEAR' ? 'Gần' : value === 'INTERMEDIATE' ? 'Trung gian' : value === 'MULTIPURPOSE' ? 'Đa dụng' : ''; }
  private designLabel(value: string | null): string { return value === 'SINGLE_VISION' ? 'Đơn tròng' : value === 'BIFOCAL' ? 'Hai tròng' : value === 'PROGRESSIVE' ? 'Đa tròng' : ''; }
  private excelDate(value: Date): string { const iso = value.toISOString().slice(0, 10); return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`; }
  private excelNumber(value: Prisma.Decimal | null): number | null { return value === null ? null : value.toNumber(); }
  private header(value: unknown): string { return this.text(value).toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/[?*]/g, '').replace(/\s+/g, ' ').trim(); }
  private text(value: unknown): string { return value === undefined || value === null ? '' : String(value).trim(); }
}
