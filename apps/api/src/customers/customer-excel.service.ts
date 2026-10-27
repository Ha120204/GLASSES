import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhone } from './phone.util';

const MAX_IMPORT_ROWS = 1_000;
const CUSTOMER_IMPORT_HEADERS = ['Họ tên*', 'Số điện thoại*', 'Ngày sinh', 'Giới tính', 'Địa chỉ', 'Ghi chú'];
const CUSTOMER_EXPORT_HEADERS = ['Họ và tên', 'Số điện thoại', 'Ngày sinh', 'Giới tính', 'Địa chỉ', 'Ghi chú', 'Ngày tạo hồ sơ'];
type ImportColumn = 'name' | 'phone' | 'birthday' | 'gender' | 'address' | 'note';
type ColumnMap = Record<ImportColumn, number | undefined>;

export interface CustomerImportRow {
  row: number;
  name: string;
  phone: string;
  birthday?: string;
  gender?: string;
  address?: string;
  note?: string;
}

export interface CustomerImportIssue {
  row: number;
  reason: string;
}

export interface CustomerImportPreview {
  total: number;
  validRows: CustomerImportRow[];
  issues: CustomerImportIssue[];
}

@Injectable()
export class CustomerExcelService {
  constructor(private readonly prisma: PrismaService) {}

  async createTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Khách hàng', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    worksheet.columns = [
      { width: 28 }, { width: 18 }, { width: 15 }, { width: 14 }, { width: 36 }, { width: 42 },
    ];
    worksheet.addRow(CUSTOMER_IMPORT_HEADERS);
    for (let index = 0; index < 10; index += 1) worksheet.addRow(Array(CUSTOMER_IMPORT_HEADERS.length).fill(null));
    this.formatGrid(worksheet, CUSTOMER_IMPORT_HEADERS.length, 11);
    worksheet.getColumn(3).numFmt = 'dd/mm/yyyy';

    const guide = workbook.addWorksheet('Hướng dẫn');
    guide.columns = [{ width: 108 }];
    [
      'Hướng dẫn nhập khách hàng',
      'Điền mỗi khách hàng trên một dòng ở trang “Khách hàng”.',
      'Các cột có dấu * là bắt buộc. Số điện thoại được dùng để nhận diện khách hàng và không được trùng.',
      'Ngày sinh có thể nhập theo dạng dd/mm/yyyy hoặc yyyy-mm-dd.',
      'Giới tính: Nam, Nữ hoặc Khác. Các cột còn lại có thể để trống.',
      `Tối đa ${MAX_IMPORT_ROWS.toLocaleString('vi-VN')} khách hàng mỗi lần nhập.`,
    ].forEach((text) => guide.addRow([text]));
    guide.getRow(1).font = { bold: true, size: 14 };
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async exportActiveCustomers(ids?: string[]): Promise<Buffer> {
    const customers = await this.prisma.customer.findMany({
      where: { deletedAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Glasses Store';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet('Khách hàng', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    worksheet.columns = [
      { width: 28 }, { width: 18 }, { width: 15 }, { width: 14 }, { width: 36 }, { width: 42 }, { width: 18 },
    ];
    const rows = customers.map((customer) => [
      customer.name,
      customer.phone,
      customer.birthday ?? null,
      this.genderLabel(customer.gender),
      customer.address ?? '',
      customer.note ?? '',
      customer.createdAt,
    ]);

    worksheet.addRow(CUSTOMER_EXPORT_HEADERS);
    rows.forEach((row) => worksheet.addRow(row));
    this.formatGrid(worksheet, CUSTOMER_EXPORT_HEADERS.length, rows.length + 1);
    worksheet.getColumn(3).numFmt = 'dd/mm/yyyy';
    worksheet.getColumn(7).numFmt = 'dd/mm/yyyy';
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private formatGrid(worksheet: ExcelJS.Worksheet, columnCount: number, rowCount: number): void {
    for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex);
      row.height = rowIndex === 1 ? 23 : 20;
      for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
        const cell = row.getCell(columnIndex);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF1F2937' } },
          left: { style: 'thin', color: { argb: 'FF1F2937' } },
          bottom: { style: 'thin', color: { argb: 'FF1F2937' } },
          right: { style: 'thin', color: { argb: 'FF1F2937' } },
        };
        cell.alignment = { vertical: 'middle', wrapText: true };
        if (rowIndex === 1) {
          cell.font = { bold: true };
        }
      }
    }
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(rowCount, 1), column: columnCount },
    };
  }

  preview(file: Buffer): CustomerImportPreview {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file, { type: 'buffer', cellDates: true });
    } catch {
      throw new BadRequestException('Không thể đọc file Excel. Vui lòng dùng file .xlsx hợp lệ.');
    }
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new BadRequestException('File Excel không có trang dữ liệu.');
    const sheet = workbook.Sheets[firstSheetName];
    const values = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: true,
    }) as unknown[][];
    if (values.length < 2) {
      return { total: 0, validRows: [], issues: [] };
    }

    const columns = this.findColumns(values[0] ?? []);
    if (columns.name === undefined || columns.phone === undefined) {
      throw new BadRequestException('Thiếu cột “Họ tên” hoặc “Số điện thoại”. Hãy giữ nguyên hàng tiêu đề của file xuất hoặc dùng file mẫu để nhập dữ liệu.');
    }

    const dataRows = values.slice(1).filter((row) => row.some((value) => this.text(value) !== ''));
    if (dataRows.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(`Mỗi lần chỉ có thể nhập tối đa ${MAX_IMPORT_ROWS.toLocaleString('vi-VN')} khách hàng.`);
    }

    const validRows: CustomerImportRow[] = [];
    const issues: CustomerImportIssue[] = [];
    const filePhones = new Set<string>();
    dataRows.forEach((row, index) => {
      const spreadsheetRow = index + 2;
      const name = this.text(row[columns.name!]);
      const rawPhone = this.text(row[columns.phone!]);
      const phone = normalizePhone(rawPhone);
      const reason = this.validateRow(name, rawPhone, phone, row, columns, filePhones);
      if (reason) {
        issues.push({ row: spreadsheetRow, reason });
        return;
      }

      filePhones.add(phone);
      validRows.push({
        row: spreadsheetRow,
        name,
        phone,
        birthday: this.parseDate(row[columns.birthday!]),
        gender: this.parseGender(row[columns.gender!]),
        address: this.text(row[columns.address!]) || undefined,
        note: this.text(row[columns.note!]) || undefined,
      });
    });
    return { total: dataRows.length, validRows, issues };
  }

  async importRows(rows: CustomerImportRow[]): Promise<{ created: number; updated: number; skipped: number }> {
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(`Mỗi lần chỉ có thể nhập tối đa ${MAX_IMPORT_ROWS.toLocaleString('vi-VN')} khách hàng.`);
    }
    const sanitizedRows = rows.map((row, index) => this.sanitizeSubmittedRow(row, index + 1));
    const uniqueRows = [...new Map(sanitizedRows.map((row) => [row.phone, row])).values()];
    if (!uniqueRows.length) return { created: 0, updated: 0, skipped: rows.length };

    const existing = await this.prisma.customer.findMany({
      where: { phone: { in: uniqueRows.map((row) => row.phone) } },
      select: { id: true, phone: true, deletedAt: true },
    });
    const activeCustomersByPhone = new Map(
      existing.filter((customer) => !customer.deletedAt).map((customer) => [customer.phone, customer]),
    );
    const deletedPhones = new Set(existing.filter((customer) => customer.deletedAt).map((customer) => customer.phone));
    const entries = uniqueRows
      .filter((row) => !activeCustomersByPhone.has(row.phone) && !deletedPhones.has(row.phone))
      .map((row) => this.customerData(row));
    const result = entries.length
      ? await this.prisma.customer.createMany({ data: entries, skipDuplicates: true })
      : { count: 0 };
    const rowsToUpdate = uniqueRows.filter((row) => activeCustomersByPhone.has(row.phone));
    if (rowsToUpdate.length) {
      await this.prisma.$transaction(
        rowsToUpdate.map((row) => this.prisma.customer.update({
          where: { id: activeCustomersByPhone.get(row.phone)!.id },
          data: this.customerData(row),
        })),
      );
    }
    return {
      created: result.count,
      updated: rowsToUpdate.length,
      skipped: sanitizedRows.length - result.count - rowsToUpdate.length,
    };
  }

  private customerData(row: CustomerImportRow) {
    return {
      name: row.name.trim(),
      phone: row.phone,
      birthday: row.birthday ? new Date(`${row.birthday}T00:00:00.000Z`) : null,
      gender: row.gender ?? null,
      address: row.address?.trim() || null,
      note: row.note?.trim() || null,
    };
  }

  private sanitizeSubmittedRow(row: CustomerImportRow, index: number): CustomerImportRow {
    const name = this.text(row?.name);
    const phone = normalizePhone(this.text(row?.phone));
    const birthday = this.parseDate(row?.birthday);
    const gender = this.parseGender(row?.gender);
    const address = this.text(row?.address);
    const note = this.text(row?.note);
    const hasInvalidBirthday = Boolean(this.text(row?.birthday)) && !birthday;
    const hasInvalidGender = Boolean(this.text(row?.gender)) && !gender;
    if (
      !name || name.length > 120 || !/^0\d{9,10}$/.test(phone) || hasInvalidBirthday || hasInvalidGender
      || address.length > 500 || note.length > 2_000
    ) {
      throw new BadRequestException(`Dữ liệu khách hàng ở dòng ${row?.row ?? index} không hợp lệ. Vui lòng xem trước file và thử lại.`);
    }
    return { row: row?.row ?? index, name, phone, birthday, gender, address: address || undefined, note: note || undefined };
  }

  private findColumns(headers: unknown[]): ColumnMap {
    const aliases: Record<string, ImportColumn> = {
      'ho ten': 'name', 'ho va ten': 'name', ten: 'name', name: 'name',
      'so dien thoai': 'phone', 'dien thoai': 'phone', phone: 'phone', sdt: 'phone',
      'ngay sinh': 'birthday', birthday: 'birthday',
      'gioi tinh': 'gender', gender: 'gender',
      'dia chi': 'address', address: 'address',
      'ghi chu': 'note', note: 'note',
    };
    const columns: ColumnMap = { name: undefined, phone: undefined, birthday: undefined, gender: undefined, address: undefined, note: undefined };
    headers.forEach((header, index) => {
      const column = aliases[this.headerText(header)];
      if (column && columns[column] === undefined) columns[column] = index;
    });
    return columns;
  }

  private validateRow(
    name: string,
    rawPhone: string,
    phone: string,
    row: unknown[],
    columns: ColumnMap,
    filePhones: Set<string>,
  ): string | null {
    if (!name) return 'Thiếu họ tên.';
    if (name.length > 120) return 'Họ tên tối đa 120 ký tự.';
    if (!rawPhone) return 'Thiếu số điện thoại.';
    if (!/^0\d{9,10}$/.test(phone)) return 'Số điện thoại không hợp lệ.';
    if (filePhones.has(phone)) return 'Số điện thoại bị trùng trong file.';
    const birthday = columns.birthday === undefined ? undefined : row[columns.birthday];
    if (this.text(birthday) && !this.parseDate(birthday)) return 'Ngày sinh không hợp lệ.';
    const gender = columns.gender === undefined ? undefined : row[columns.gender];
    if (this.text(gender) && !this.parseGender(gender)) return 'Giới tính chỉ có thể là Nam, Nữ hoặc Khác.';
    const address = this.text(columns.address === undefined ? undefined : row[columns.address]);
    if (address.length > 500) return 'Địa chỉ tối đa 500 ký tự.';
    const note = this.text(columns.note === undefined ? undefined : row[columns.note]);
    if (note.length > 2_000) return 'Ghi chú tối đa 2.000 ký tự.';
    return null;
  }

  private parseDate(value: unknown): string | undefined {
    if (!this.text(value)) return undefined;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return this.toDateValue(value);
    if (typeof value === 'number') {
      const dateCode = XLSX.SSF.parse_date_code(value);
      if (!dateCode) return undefined;
      return `${dateCode.y}-${String(dateCode.m).padStart(2, '0')}-${String(dateCode.d).padStart(2, '0')}`;
    }
    const input = this.text(value);
    const vietnameseDate = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (vietnameseDate) {
      const [, day, month, year] = vietnameseDate;
      return this.checkedDate(Number(year), Number(month), Number(day));
    }
    const isoDate = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoDate) {
      const [, year, month, day] = isoDate;
      return this.checkedDate(Number(year), Number(month), Number(day));
    }
    return undefined;
  }

  private checkedDate(year: number, month: number, day: number): string | undefined {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private parseGender(value: unknown): string | undefined {
    const gender = this.headerText(value);
    if (!gender) return undefined;
    if (['nam', 'male', 'm'].includes(gender)) return 'MALE';
    if (['nu', 'female', 'f'].includes(gender)) return 'FEMALE';
    if (['khac', 'other', 'o'].includes(gender)) return 'OTHER';
    return undefined;
  }

  private genderLabel(gender: string | null): string {
    return gender === 'MALE' ? 'Nam' : gender === 'FEMALE' ? 'Nữ' : gender === 'OTHER' ? 'Khác' : '';
  }

  private headerText(value: unknown): string {
    return this.text(value).toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/[?*]/g, '').replace(/\s+/g, ' ').trim();
  }

  private text(value: unknown): string {
    return value === undefined || value === null ? '' : String(value).trim();
  }

  private toDateValue(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }
}
