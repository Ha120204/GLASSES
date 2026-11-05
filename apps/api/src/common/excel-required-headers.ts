import type * as ExcelJS from 'exceljs';

/** Keep the header text intact for Excel imports while highlighting only the required marker. */
export function colorRequiredHeaderAsterisks(sheet: ExcelJS.Worksheet, headers: readonly string[]): void {
  headers.forEach((header, index) => {
    if (!header.endsWith('*')) return;
    sheet.getRow(1).getCell(index + 1).value = {
      richText: [
        { text: header.slice(0, -1), font: { bold: true, color: { argb: 'FF000000' } } },
        { text: '*', font: { bold: true, color: { argb: 'FFDC2626' } } },
      ],
    };
  });
}
