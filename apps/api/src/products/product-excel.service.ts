import { BadRequestException, Injectable } from '@nestjs/common';
import { ProductType } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';

const MAX_IMPORT_ROWS = 1_000;
const PRODUCT_IMPORT_HEADERS = ['Mã sản phẩm', 'Tên sản phẩm*', 'Danh mục*', 'Thương hiệu', 'Mã vạch', 'Giá vốn*', 'Giá bán*', 'Nhà cung cấp', 'Trạng thái'];
const PRODUCT_EXPORT_HEADERS = ['Mã sản phẩm', 'Tên sản phẩm', 'Danh mục', 'Thương hiệu', 'Mã vạch', 'Giá vốn', 'Giá bán', 'Nhà cung cấp', 'Trạng thái'];
type ImportColumn = 'sku' | 'name' | 'type' | 'brand' | 'barcode' | 'costPrice' | 'salePrice' | 'supplier' | 'active';
type ColumnMap = Record<ImportColumn, number | undefined>;

export interface ProductImportRow {
  row: number;
  sku?: string;
  name: string;
  type: ProductType;
  brand?: string;
  barcode?: string;
  costPrice: number;
  salePrice: number;
  supplier?: string;
  active: boolean;
}
export interface ProductImportIssue { row: number; reason: string; }
export interface ProductImportPreview { total: number; validRows: ProductImportRow[]; issues: ProductImportIssue[]; }

const TYPE_LABELS: Record<ProductType, string> = { FRAME: 'Gọng kính', LENS: 'Tròng kính', CONTACT: 'Kính áp tròng', ACCESSORY: 'Phụ kiện' };

@Injectable()
export class ProductExcelService {
  constructor(private readonly prisma: PrismaService, private readonly productsService: ProductsService) {}

  async createTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sản phẩm', { views: [{ state: 'frozen', ySplit: 1 }] });
    worksheet.columns = [
      { width: 20 }, { width: 34 }, { width: 18 }, { width: 20 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 24 }, { width: 18 },
    ];
    worksheet.addRow(PRODUCT_IMPORT_HEADERS);
    for (let index = 0; index < 10; index += 1) worksheet.addRow(Array(PRODUCT_IMPORT_HEADERS.length).fill(null));
    this.formatGrid(worksheet, PRODUCT_IMPORT_HEADERS.length, 11);
    worksheet.getColumn(6).numFmt = '#,##0';
    worksheet.getColumn(7).numFmt = '#,##0';

    const guide = workbook.addWorksheet('Hướng dẫn');
    guide.columns = [{ width: 112 }];
    [
      'Hướng dẫn nhập sản phẩm',
      'Mỗi sản phẩm nằm trên một dòng ở trang “Sản phẩm”.',
      'Các cột có dấu * là bắt buộc. Mã sản phẩm có thể để trống để hệ thống tự tạo theo danh mục.',
      'Danh mục: Gọng kính, Tròng kính, Kính áp tròng hoặc Phụ kiện.',
      'Giá vốn và Giá bán là số nguyên không âm, tính bằng Việt Nam đồng.',
      'Trạng thái: Đang kinh doanh hoặc Ngừng kinh doanh. Có thể để trống để mặc định Đang kinh doanh.',
      'SKU trùng với sản phẩm đang hoạt động sẽ cập nhật sản phẩm đó. SKU trong thùng rác không được nhập lại.',
      `Mỗi lần chỉ nhập tối đa ${MAX_IMPORT_ROWS.toLocaleString('vi-VN')} sản phẩm.`,
    ].forEach((text) => guide.addRow([text]));
    guide.getRow(1).font = { bold: true, size: 14 };
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async exportActiveProducts(query: { q?: string; type?: ProductType; ids?: string[] }): Promise<Buffer> {
    const q = query.q?.trim();
    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(query.ids?.length ? { id: { in: query.ids } } : {}),
        ...(!query.ids?.length && query.type ? { type: query.type } : {}),
        ...(!query.ids?.length && q ? { OR: [
          { sku: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } },
          { barcode: { contains: q, mode: 'insensitive' } }, { brand: { contains: q, mode: 'insensitive' } },
        ] } : {}),
      },
      orderBy: { name: 'asc' },
    });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Glasses Store';
    const worksheet = workbook.addWorksheet('Sản phẩm', { views: [{ state: 'frozen', ySplit: 1 }] });
    worksheet.columns = [
      { width: 20 }, { width: 34 }, { width: 18 }, { width: 20 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 24 }, { width: 18 },
    ];
    worksheet.addRow(PRODUCT_EXPORT_HEADERS);
    products.forEach((product) => worksheet.addRow([
      product.sku, product.name, TYPE_LABELS[product.type], product.brand ?? '', product.barcode ?? '', product.costPrice,
      product.salePrice, product.supplier ?? '', product.active ? 'Đang kinh doanh' : 'Ngừng kinh doanh',
    ]));
    this.formatGrid(worksheet, PRODUCT_EXPORT_HEADERS.length, products.length + 1);
    worksheet.getColumn(6).numFmt = '#,##0';
    worksheet.getColumn(7).numFmt = '#,##0';
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async preview(file: Buffer): Promise<ProductImportPreview> {
    let workbook: XLSX.WorkBook;
    try { workbook = XLSX.read(file, { type: 'buffer', cellDates: true }); } catch { throw new BadRequestException('Không thể đọc file Excel. Vui lòng dùng file .xlsx hợp lệ.'); }
    const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ''];
    if (!sheet) throw new BadRequestException('File Excel không có trang dữ liệu.');
    const values = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as unknown[][];
    if (values.length < 2) return { total: 0, validRows: [], issues: [] };
    const columns = this.findColumns(values[0] ?? []);
    if (columns.name === undefined || columns.type === undefined || columns.costPrice === undefined || columns.salePrice === undefined) {
      throw new BadRequestException('Thiếu cột Tên sản phẩm, Danh mục, Giá vốn hoặc Giá bán. Hãy dùng file mẫu hoặc file đã xuất từ hệ thống.');
    }
    const dataRows = values.slice(1).filter((row) => row.some((value) => this.text(value) !== ''));
    if (dataRows.length > MAX_IMPORT_ROWS) throw new BadRequestException(`Mỗi lần chỉ có thể nhập tối đa ${MAX_IMPORT_ROWS.toLocaleString('vi-VN')} sản phẩm.`);
    const validRows: ProductImportRow[] = [];
    const issues: ProductImportIssue[] = [];
    const seenSkus = new Set<string>();
    const seenBarcodes = new Set<string>();
    dataRows.forEach((row, index) => {
      const parsed = this.parseRow(row, index + 2, columns, seenSkus, seenBarcodes);
      if ('reason' in parsed) issues.push(parsed);
      else validRows.push(parsed);
    });
    const databaseIssues = await this.databaseIssues(validRows);
    const rejectedRows = new Set(databaseIssues.map((issue) => issue.row));
    return { total: dataRows.length, validRows: validRows.filter((row) => !rejectedRows.has(row.row)), issues: [...issues, ...databaseIssues] };
  }

  async importRows(rows: ProductImportRow[]): Promise<{ created: number; updated: number; skipped: number }> {
    if (rows.length > MAX_IMPORT_ROWS) throw new BadRequestException(`Mỗi lần chỉ có thể nhập tối đa ${MAX_IMPORT_ROWS.toLocaleString('vi-VN')} sản phẩm.`);
    let created = 0; let updated = 0; let skipped = 0;
    for (const row of rows) {
      const product = this.sanitizeSubmittedRow(row);
      const existing = product.sku ? await this.prisma.product.findUnique({ where: { sku: product.sku } }) : null;
      if (existing?.deletedAt) { skipped += 1; continue; }
      try {
        if (existing) {
          await this.productsService.update(existing.id, product);
          updated += 1;
        } else {
          await this.productsService.create({ ...product, sku: product.sku ?? '', autoSku: !product.sku });
          created += 1;
        }
      } catch { skipped += 1; }
    }
    return { created, updated, skipped };
  }

  private async databaseIssues(rows: ProductImportRow[]): Promise<ProductImportIssue[]> {
    const skus = rows.flatMap((row) => row.sku ? [row.sku] : []);
    const barcodes = rows.flatMap((row) => row.barcode ? [row.barcode] : []);
    const existing = await this.prisma.product.findMany({ where: { OR: [{ sku: { in: skus } }, { barcode: { in: barcodes } }] }, select: { sku: true, barcode: true, deletedAt: true } });
    const existingBySku = new Map(existing.map((item) => [item.sku, item]));
    const existingByBarcode = new Map(existing.filter((item) => item.barcode).map((item) => [item.barcode!, item]));
    return rows.flatMap((row) => {
      const skuProduct = row.sku ? existingBySku.get(row.sku) : undefined;
      if (skuProduct?.deletedAt) return [{ row: row.row, reason: 'Mã sản phẩm thuộc sản phẩm trong thùng rác.' }];
      const barcodeProduct = row.barcode ? existingByBarcode.get(row.barcode) : undefined;
      if (barcodeProduct && barcodeProduct.sku !== row.sku) return [{ row: row.row, reason: 'Mã vạch đã được dùng bởi sản phẩm khác.' }];
      return [];
    });
  }

  private parseRow(row: unknown[], spreadsheetRow: number, columns: ColumnMap, seenSkus: Set<string>, seenBarcodes: Set<string>): ProductImportRow | ProductImportIssue {
    const sku = this.text(columns.sku === undefined ? undefined : row[columns.sku]).toUpperCase();
    const name = this.text(row[columns.name!]);
    const type = this.parseType(row[columns.type!]);
    const barcode = this.text(columns.barcode === undefined ? undefined : row[columns.barcode]).toUpperCase();
    const costPrice = this.parseMoney(row[columns.costPrice!]);
    const salePrice = this.parseMoney(row[columns.salePrice!]);
    const active = this.parseActive(columns.active === undefined ? undefined : row[columns.active]);
    if (!name) return { row: spreadsheetRow, reason: 'Thiếu tên sản phẩm.' };
    if (name.length > 200) return { row: spreadsheetRow, reason: 'Tên sản phẩm tối đa 200 ký tự.' };
    if (!type) return { row: spreadsheetRow, reason: 'Danh mục không hợp lệ.' };
    if (sku.length > 80) return { row: spreadsheetRow, reason: 'Mã sản phẩm tối đa 80 ký tự.' };
    if (sku && seenSkus.has(sku)) return { row: spreadsheetRow, reason: 'Mã sản phẩm bị trùng trong file.' };
    if (barcode.length > 80) return { row: spreadsheetRow, reason: 'Mã vạch tối đa 80 ký tự.' };
    if (barcode && seenBarcodes.has(barcode)) return { row: spreadsheetRow, reason: 'Mã vạch bị trùng trong file.' };
    if (costPrice === undefined || salePrice === undefined) return { row: spreadsheetRow, reason: 'Giá vốn và Giá bán phải là số nguyên không âm.' };
    if (active === undefined) return { row: spreadsheetRow, reason: 'Trạng thái không hợp lệ.' };
    if (sku) seenSkus.add(sku);
    if (barcode) seenBarcodes.add(barcode);
    return { row: spreadsheetRow, sku: sku || undefined, name, type, barcode: barcode || undefined, costPrice, salePrice, active,
      brand: this.text(columns.brand === undefined ? undefined : row[columns.brand]) || undefined,
      supplier: this.text(columns.supplier === undefined ? undefined : row[columns.supplier]) || undefined };
  }

  private sanitizeSubmittedRow(row: ProductImportRow): Omit<ProductImportRow, 'row'> {
    const name = this.text(row?.name); const type = this.parseType(row?.type); const sku = this.text(row?.sku).toUpperCase();
    const barcode = this.text(row?.barcode).toUpperCase(); const costPrice = this.parseMoney(row?.costPrice); const salePrice = this.parseMoney(row?.salePrice);
    const active = typeof row?.active === 'boolean' ? row.active : this.parseActive(row?.active);
    if (!name || !type || name.length > 200 || sku.length > 80 || barcode.length > 80 || costPrice === undefined || salePrice === undefined || active === undefined) {
      throw new BadRequestException(`Dữ liệu sản phẩm ở dòng ${row?.row ?? '?'} không hợp lệ.`);
    }
    return { sku: sku || undefined, name, type, barcode: barcode || undefined, costPrice, salePrice, active,
      brand: this.text(row?.brand) || undefined, supplier: this.text(row?.supplier) || undefined };
  }

  private findColumns(headers: unknown[]): ColumnMap {
    const aliases: Record<string, ImportColumn> = {
      'ma san pham': 'sku', sku: 'sku', 'ten san pham': 'name', name: 'name', 'danh muc': 'type', 'loai san pham': 'type', type: 'type',
      'thuong hieu': 'brand', brand: 'brand', 'ma vach': 'barcode', barcode: 'barcode', 'gia von': 'costPrice', 'gia ban': 'salePrice',
      'nha cung cap': 'supplier', supplier: 'supplier', 'trang thai': 'active', active: 'active',
    };
    const columns: ColumnMap = { sku: undefined, name: undefined, type: undefined, brand: undefined, barcode: undefined, costPrice: undefined, salePrice: undefined, supplier: undefined, active: undefined };
    headers.forEach((header, index) => { const column = aliases[this.headerText(header)]; if (column && columns[column] === undefined) columns[column] = index; });
    return columns;
  }

  private parseType(value: unknown): ProductType | undefined {
    const input = this.headerText(value);
    if (['gong kinh', 'frame', 'gong'].includes(input)) return ProductType.FRAME;
    if (['trong kinh', 'lens', 'trong'].includes(input)) return ProductType.LENS;
    if (['kinh ap trong', 'contact'].includes(input)) return ProductType.CONTACT;
    if (['phu kien', 'accessory', 'pk'].includes(input)) return ProductType.ACCESSORY;
    return undefined;
  }

  private parseActive(value: unknown): boolean | undefined {
    const input = this.headerText(value);
    if (!input || ['dang kinh doanh', 'dang ban', 'true', '1', 'co', 'yes'].includes(input)) return true;
    if (['ngung kinh doanh', 'tam ngung', 'false', '0', 'khong', 'no'].includes(input)) return false;
    return undefined;
  }

  private parseMoney(value: unknown): number | undefined {
    if (typeof value === 'number') return Number.isInteger(value) && value >= 0 ? value : undefined;
    const input = this.text(value).replace(/[^\d]/g, '');
    if (!input) return this.text(value) ? undefined : undefined;
    const parsed = Number(input);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  }

  private formatGrid(worksheet: ExcelJS.Worksheet, columnCount: number, rowCount: number): void {
    for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex); row.height = rowIndex === 1 ? 23 : 20;
      for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
        const cell = row.getCell(columnIndex);
        cell.border = { top: { style: 'thin', color: { argb: 'FF000000' } }, left: { style: 'thin', color: { argb: 'FF000000' } }, bottom: { style: 'thin', color: { argb: 'FF000000' } }, right: { style: 'thin', color: { argb: 'FF000000' } } };
        cell.alignment = { vertical: 'middle', wrapText: true };
        if (rowIndex === 1) { cell.font = { bold: true, color: { argb: 'FF000000' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; }
      }
    }
    worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(rowCount, 1), column: columnCount } };
  }

  private headerText(value: unknown): string { return this.text(value).toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/[?*]/g, '').replace(/\s+/g, ' ').trim(); }
  private text(value: unknown): string { return value === undefined || value === null ? '' : String(value).trim(); }
}
