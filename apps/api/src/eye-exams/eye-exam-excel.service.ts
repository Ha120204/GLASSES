import { BadRequestException, Injectable } from '@nestjs/common';
import { EyeExamAuditAction, Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { normalizePhone } from '../customers/phone.util';
import { PrismaService } from '../prisma/prisma.service';
import { EyeExamQueryDto } from './dto/eye-exam-query.dto';

const MAX_IMPORT_ROWS = 1_000;
const HEADERS = ['Số điện thoại khách hàng*', 'Ngày đo*', 'SPH MP', 'CYL MP', 'AXIS MP', 'ADD MP', 'PD MP', 'PRISM MP', 'BASE MP', 'Cao lắp MP', 'SPH MT', 'CYL MT', 'AXIS MT', 'ADD MT', 'PD MT', 'PRISM MT', 'BASE MT', 'Cao lắp MT', 'PD tổng', 'Nhu cầu đeo', 'Thiết kế tròng', 'Không kê đơn', 'Lý do không kê đơn', 'Ghi chú'];
const EXPORT_HEADERS = ['ID phiếu', ...HEADERS, 'Trạng thái'];
type Key = 'phone' | 'examDate' | 'rSph' | 'rCyl' | 'rAxis' | 'rAdd' | 'rPd' | 'rPrism' | 'rBase' | 'rSegHeight' | 'lSph' | 'lCyl' | 'lAxis' | 'lAdd' | 'lPd' | 'lPrism' | 'lBase' | 'lSegHeight' | 'pdTotal' | 'wearingPurpose' | 'lensDesign' | 'noPrescription' | 'noPrescriptionReason' | 'note';
type Columns = Record<Key, number | undefined>;
export interface EyeExamImportRow { row: number; phone: string; examDate: string; rSph?: number; rCyl?: number; rAxis?: number; rAdd?: number; rPd?: number; rPrism?: number; rBase?: string; rSegHeight?: number; lSph?: number; lCyl?: number; lAxis?: number; lAdd?: number; lPd?: number; lPrism?: number; lBase?: string; lSegHeight?: number; pdTotal?: number; wearingPurpose?: string; lensDesign?: string; noPrescription: boolean; noPrescriptionReason?: string; note?: string; }
export interface EyeExamImportIssue { row: number; reason: string; }
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
    sheet.getColumn(2).numFmt = 'dd/mm/yyyy';
    const guide = workbook.addWorksheet('Hướng dẫn');
    guide.columns = [{ width: 118 }];
    ['Hướng dẫn nhập phiếu đo mắt', 'Mỗi dòng tạo một phiếu nháp mới. Hệ thống không ghi đè phiếu đang có và không tự chốt phiếu.', 'Khách hàng phải có sẵn trong hệ thống; dùng số điện thoại để đối chiếu.', 'Cột có dấu * là bắt buộc. Ngày đo: dd/mm/yyyy hoặc yyyy-mm-dd. Các số khúc xạ nhập theo đơn vị diop; AXIS từ 0 đến 180; PD và cao lắp tính bằng mm.', 'Nhu cầu đeo: Xa, Gần, Trung gian, Đa dụng. Thiết kế tròng: Đơn tròng, Hai tròng, Đa tròng. BASE: BI, BO, BU hoặc BD.', `Tối đa ${MAX_IMPORT_ROWS.toLocaleString('vi-VN')} phiếu mỗi lần nhập. Luôn xem trước các dòng lỗi trước khi xác nhận.`].forEach((value) => guide.addRow([value]));
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
      customer: { deletedAt: null, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: normalizePhone(q) } }] } : {}) },
    };
    const exams = await this.prisma.eyeExam.findMany({ where, orderBy: { examDate: 'desc' }, include: { customer: { select: { phone: true } } } });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Phiếu đo mắt', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [{ width: 28 }, { width: 18 }, { width: 14 }, ...Array(16).fill({ width: 12 }), { width: 12 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 28 }, { width: 42 }, { width: 14 }];
    sheet.addRow(EXPORT_HEADERS);
    exams.forEach((exam) => sheet.addRow([exam.id, exam.customer.phone, exam.examDate, exam.rSph, exam.rCyl, exam.rAxis, exam.rAdd, exam.rPd, exam.rPrism, exam.rBase, exam.rSegHeight, exam.lSph, exam.lCyl, exam.lAxis, exam.lAdd, exam.lPd, exam.lPrism, exam.lBase, exam.lSegHeight, exam.pdTotal, this.purposeLabel(exam.wearingPurpose), this.designLabel(exam.lensDesign), exam.noPrescription ? 'Có' : 'Không', exam.noPrescriptionReason, exam.note, exam.lockedAt ? 'Đã chốt' : 'Bản nháp']));
    this.formatGrid(sheet, EXPORT_HEADERS.length, exams.length + 1);
    sheet.getColumn(3).numFmt = 'dd/mm/yyyy';
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  preview(file: Buffer): EyeExamImportPreview {
    let workbook: XLSX.WorkBook;
    try { workbook = XLSX.read(file, { type: 'buffer', cellDates: true }); } catch { throw new BadRequestException('Không thể đọc file Excel. Vui lòng dùng file .xlsx hợp lệ.'); }
    const first = workbook.SheetNames[0];
    if (!first) throw new BadRequestException('File Excel không có trang dữ liệu.');
    const values = XLSX.utils.sheet_to_json(workbook.Sheets[first], { header: 1, defval: '', raw: true }) as unknown[][];
    if (values.length < 2) return { total: 0, validRows: [], issues: [] };
    const columns = this.findColumns(values[0] ?? []);
    if (columns.phone === undefined || columns.examDate === undefined) throw new BadRequestException('Thiếu cột “Số điện thoại khách hàng” hoặc “Ngày đo”. Hãy dùng file mẫu để nhập.');
    const rows = values.slice(1).filter((row) => row.some((cell) => this.text(cell)));
    if (rows.length > MAX_IMPORT_ROWS) throw new BadRequestException(`Mỗi lần chỉ có thể nhập tối đa ${MAX_IMPORT_ROWS.toLocaleString('vi-VN')} phiếu đo.`);
    const validRows: EyeExamImportRow[] = []; const issues: EyeExamImportIssue[] = []; const identities = new Set<string>();
    rows.forEach((row, index) => { const result = this.readRow(row, index + 2, columns, identities); if ('reason' in result) issues.push(result); else { identities.add(`${result.phone}|${result.examDate}`); validRows.push(result); } });
    return { total: rows.length, validRows, issues };
  }

  async importRows(rows: EyeExamImportRow[], createdById: string): Promise<{ created: number; skipped: number }> {
    if (!rows.length || rows.length > MAX_IMPORT_ROWS) throw new BadRequestException('Số dòng nhập không hợp lệ.');
    const cleaned = rows.map((row, index) => this.readSubmittedRow(row, index + 1));
    const customers = await this.prisma.customer.findMany({ where: { phone: { in: [...new Set(cleaned.map((row) => row.phone))] }, deletedAt: null }, select: { id: true, phone: true } });
    const customerIds = new Map(customers.map((customer) => [customer.phone, customer.id]));
    const missing = cleaned.find((row) => !customerIds.has(row.phone));
    if (missing) throw new BadRequestException(`Không tìm thấy khách hàng có số điện thoại ${missing.phone} ở dòng ${missing.row}. Hãy tạo khách hàng trước khi nhập phiếu đo.`);
    await this.prisma.$transaction(async (transaction) => {
      for (const row of cleaned) {
        const exam = await transaction.eyeExam.create({ data: { ...this.toData(row), customerId: customerIds.get(row.phone)! } });
        await transaction.eyeExamAuditLog.create({ data: { eyeExamId: exam.id, action: EyeExamAuditAction.CREATED, changes: { source: 'EXCEL_IMPORT', row: row.row }, createdById } });
      }
    });
    return { created: cleaned.length, skipped: rows.length - cleaned.length };
  }

  private readSubmittedRow(row: EyeExamImportRow, fallback: number): EyeExamImportRow { const result = this.readRow(this.toRawRow(row), row.row ?? fallback, this.findColumns(HEADERS), new Set()); if ('reason' in result) throw new BadRequestException(`Dữ liệu phiếu đo ở dòng ${result.row} không hợp lệ: ${result.reason}`); return result; }
  private toRawRow(row: EyeExamImportRow): unknown[] { return [row.phone, row.examDate, row.rSph, row.rCyl, row.rAxis, row.rAdd, row.rPd, row.rPrism, row.rBase, row.rSegHeight, row.lSph, row.lCyl, row.lAxis, row.lAdd, row.lPd, row.lPrism, row.lBase, row.lSegHeight, row.pdTotal, row.wearingPurpose, row.lensDesign, row.noPrescription, row.noPrescriptionReason, row.note]; }
  private readRow(row: unknown[], spreadsheetRow: number, columns: Columns, identities: Set<string>): EyeExamImportRow | EyeExamImportIssue {
    const phone = normalizePhone(this.text(row[columns.phone!])); const examDate = this.parseDate(row[columns.examDate!]);
    if (!/^0\d{9,10}$/.test(phone)) return { row: spreadsheetRow, reason: 'Số điện thoại khách hàng không hợp lệ.' };
    if (!examDate) return { row: spreadsheetRow, reason: 'Ngày đo không hợp lệ.' };
    if (identities.has(`${phone}|${examDate}`)) return { row: spreadsheetRow, reason: 'Trùng khách hàng và ngày đo trong file.' };
    const numeric = (key: Key, min: number, max: number, quarter = false): number | undefined | string => { const value = row[columns[key]!]; if (!this.text(value)) return undefined; const number = Number(value); return Number.isFinite(number) && number >= min && number <= max && (!quarter || Math.round(number * 4) === number * 4) ? number : 'invalid'; };
    const fields: Record<string, unknown> = {};
    for (const [key, min, max, quarter] of [['rSph', -30, 30, true], ['rCyl', -30, 30, true], ['rAxis', 0, 180, false], ['rAdd', 0, 4, true], ['rPd', 20, 80, false], ['rPrism', 0, 20, true], ['rSegHeight', 5, 50, false], ['lSph', -30, 30, true], ['lCyl', -30, 30, true], ['lAxis', 0, 180, false], ['lAdd', 0, 4, true], ['lPd', 20, 80, false], ['lPrism', 0, 20, true], ['lSegHeight', 5, 50, false], ['pdTotal', 40, 80, false]] as const) { const value = numeric(key, min, max, quarter); if (value === 'invalid') return { row: spreadsheetRow, reason: `${key} không hợp lệ.` }; fields[key] = value; }
    const rBase = this.base(row[columns.rBase!]); const lBase = this.base(row[columns.lBase!]); if (rBase === 'invalid' || lBase === 'invalid') return { row: spreadsheetRow, reason: 'BASE chỉ có thể là BI, BO, BU hoặc BD.' };
    const noPrescription = this.boolean(row[columns.noPrescription!]); if (noPrescription === undefined) return { row: spreadsheetRow, reason: 'Không kê đơn chỉ có thể là Có hoặc Không.' };
    const wearingPurpose = this.purpose(row[columns.wearingPurpose!]); const lensDesign = this.design(row[columns.lensDesign!]); if (wearingPurpose === 'invalid' || lensDesign === 'invalid') return { row: spreadsheetRow, reason: 'Nhu cầu đeo hoặc thiết kế tròng không hợp lệ.' };
    const noPrescriptionReason = this.text(row[columns.noPrescriptionReason!]); const note = this.text(row[columns.note!]);
    if (noPrescription && !noPrescriptionReason) return { row: spreadsheetRow, reason: 'Cần nêu lý do khi chọn không kê đơn.' }; if (noPrescription && Object.values(fields).some((value) => value !== undefined)) return { row: spreadsheetRow, reason: 'Phiếu không kê đơn không thể có thông số khúc xạ.' }; if (noPrescriptionReason.length > 500 || note.length > 2_000) return { row: spreadsheetRow, reason: 'Lý do hoặc ghi chú vượt quá độ dài cho phép.' };
    return { row: spreadsheetRow, phone, examDate, ...(fields as Omit<EyeExamImportRow, 'row' | 'phone' | 'examDate' | 'noPrescription'>), rBase: rBase || undefined, lBase: lBase || undefined, noPrescription, noPrescriptionReason: noPrescriptionReason || undefined, note: note || undefined, wearingPurpose: wearingPurpose || undefined, lensDesign: lensDesign || undefined };
  }
  private toData(row: EyeExamImportRow): Omit<Prisma.EyeExamUncheckedCreateInput, 'customerId'> { const data = Object.fromEntries(Object.entries(row).filter(([key]) => !['row', 'phone', 'examDate'].includes(key))) as Omit<EyeExamImportRow, 'row' | 'phone' | 'examDate'>; return { ...data, examDate: new Date(`${row.examDate}T00:00:00.000Z`), noPrescription: row.noPrescription, noPrescriptionReason: row.noPrescriptionReason ?? null, note: row.note ?? null, wearingPurpose: row.wearingPurpose ?? null, lensDesign: row.lensDesign ?? null }; }
  private findColumns(headers: unknown[]): Columns { const aliases: Record<string, Key> = { 'so dien thoai khach hang': 'phone', 'so dien thoai': 'phone', 'ngay do': 'examDate', 'sph mp': 'rSph', 'cyl mp': 'rCyl', 'axis mp': 'rAxis', 'add mp': 'rAdd', 'pd mp': 'rPd', 'prism mp': 'rPrism', 'base mp': 'rBase', 'cao lap mp': 'rSegHeight', 'sph mt': 'lSph', 'cyl mt': 'lCyl', 'axis mt': 'lAxis', 'add mt': 'lAdd', 'pd mt': 'lPd', 'prism mt': 'lPrism', 'base mt': 'lBase', 'cao lap mt': 'lSegHeight', 'pd tong': 'pdTotal', 'nhu cau deo': 'wearingPurpose', 'thiet ke trong': 'lensDesign', 'khong ke don': 'noPrescription', 'ly do khong ke don': 'noPrescriptionReason', 'ghi chu': 'note' }; const columns = {} as Columns; headers.forEach((header, index) => { const key = aliases[this.header(header)]; if (key && columns[key] === undefined) columns[key] = index; }); return columns; }
  private formatGrid(sheet: ExcelJS.Worksheet, columns: number, rows: number): void { for (let r = 1; r <= rows; r += 1) { const row = sheet.getRow(r); row.height = r === 1 ? 23 : 20; for (let c = 1; c <= columns; c += 1) { const cell = row.getCell(c); cell.border = { top: { style: 'thin', color: { argb: 'FF000000' } }, left: { style: 'thin', color: { argb: 'FF000000' } }, bottom: { style: 'thin', color: { argb: 'FF000000' } }, right: { style: 'thin', color: { argb: 'FF000000' } } }; cell.alignment = { vertical: 'middle', wrapText: true }; if (r === 1) cell.font = { bold: true, color: { argb: 'FF000000' } }; } } sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(rows, 1), column: columns } }; }
  private parseDate(value: unknown): string | undefined { if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10); if (typeof value === 'number') { const date = XLSX.SSF.parse_date_code(value); return date ? `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}` : undefined; } const input = this.text(value); const vietnamese = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); const iso = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (!vietnamese && !iso) return undefined; const [year, month, day] = vietnamese ? [Number(vietnamese[3]), Number(vietnamese[2]), Number(vietnamese[1])] : [Number(iso![1]), Number(iso![2]), Number(iso![3])]; const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : undefined; }
  private base(value: unknown): string | undefined | 'invalid' { const input = this.header(value).toUpperCase(); return !input ? undefined : ['BI', 'BO', 'BU', 'BD'].includes(input) ? input : 'invalid'; }
  private boolean(value: unknown): boolean | undefined { const input = this.header(value); return !input || ['khong', 'false', '0', 'no'].includes(input) ? false : ['co', 'true', '1', 'yes'].includes(input) ? true : undefined; }
  private purpose(value: unknown): string | undefined | 'invalid' { const input = this.header(value); return !input ? undefined : ['xa', 'distance'].includes(input) ? 'DISTANCE' : ['gan', 'near'].includes(input) ? 'NEAR' : ['trung gian', 'intermediate'].includes(input) ? 'INTERMEDIATE' : ['da dung', 'multipurpose'].includes(input) ? 'MULTIPURPOSE' : 'invalid'; }
  private design(value: unknown): string | undefined | 'invalid' { const input = this.header(value); return !input ? undefined : ['don trong', 'single vision'].includes(input) ? 'SINGLE_VISION' : ['hai trong', 'bifocal'].includes(input) ? 'BIFOCAL' : ['da trong', 'progressive'].includes(input) ? 'PROGRESSIVE' : 'invalid'; }
  private purposeLabel(value: string | null): string { return value === 'DISTANCE' ? 'Xa' : value === 'NEAR' ? 'Gần' : value === 'INTERMEDIATE' ? 'Trung gian' : value === 'MULTIPURPOSE' ? 'Đa dụng' : ''; }
  private designLabel(value: string | null): string { return value === 'SINGLE_VISION' ? 'Đơn tròng' : value === 'BIFOCAL' ? 'Hai tròng' : value === 'PROGRESSIVE' ? 'Đa tròng' : ''; }
  private header(value: unknown): string { return this.text(value).toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/[?*]/g, '').replace(/\s+/g, ' ').trim(); }
  private text(value: unknown): string { return value === undefined || value === null ? '' : String(value).trim(); }
}
