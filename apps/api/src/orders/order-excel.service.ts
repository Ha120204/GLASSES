import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus, PaymentType, Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PassThrough } from 'stream';
import { PrismaService } from '../prisma/prisma.service';
import { OrderQueryDto } from './dto/order-query.dto';

const headers = [
  'Mã đơn',
  'Ngày tạo',
  'Khách hàng',
  'Số điện thoại',
  'Sản phẩm',
  'Hẹn khách lấy kính',
  'Tổng đơn',
  'Đã nhận / tiền cọc',
  'Đã thu thêm',
  'Tổng đã nhận',
  'Còn phải thu',
  'Tình trạng',
  'Bảo hành đến',
  'Ghi chú',
];

const statusLabels: Record<OrderStatus, string> = {
  IN_PROGRESS: 'Đang thực hiện',
  AWAITING_PAYMENT: 'Chờ thanh toán QR',
  DELIVERED: 'Đã giao · hoàn tất',
  CANCELLED: 'Đã hủy',
};

const vietnamDayRange = (): { start: Date; end: Date } => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const day = ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)?.value ?? '')
    .join('-');
  const start = new Date(`${day}T00:00:00.000+07:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

@Injectable()
export class OrderExcelService {
  constructor(private readonly prisma: PrismaService) {}

  async export(query: OrderQueryDto & { ids?: string[] }): Promise<PassThrough> {
    const where = await this.createWhere(query);
    const output = new PassThrough();
    void this.writeExport(output, where, query.sortDirection).catch((error: unknown) => output.destroy(error instanceof Error ? error : new Error(String(error))));
    return output;
  }

  private async writeExport(output: PassThrough, where: Prisma.OrderWhereInput, sortDirection: 'asc' | 'desc'): Promise<void> {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: output, useStyles: true, useSharedStrings: false });
    workbook.creator = 'Glasses Store';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Đơn hàng', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      { width: 22 }, { width: 15 }, { width: 25 }, { width: 17 }, { width: 42 }, { width: 19 },
      { width: 16 }, { width: 19 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 21 },
      { width: 17 }, { width: 42 },
    ];
    sheet.autoFilter = { from: 'A1', to: 'N1' };
    [2, 6, 13].forEach((column) => {
      sheet.getColumn(column).numFmt = 'dd/mm/yyyy';
    });
    [7, 8, 9, 10, 11].forEach((column) => {
      sheet.getColumn(column).numFmt = '#,##0';
    });
    this.formatRow(sheet.addRow(headers), true);
    let cursor: string | undefined;
    do {
      if (output.destroyed) return;
      const orders = await this.prisma.order.findMany({
        where,
        include: {
          customer: { select: { name: true, phone: true } },
          items: { select: { name: true, qty: true } },
          payments: { select: { amount: true, type: true } },
        },
        orderBy: [{ createdAt: sortDirection }, { id: sortDirection }],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: 500,
      });
      for (const order of orders) {
        if (output.destroyed) return;
        const additionalPaid = order.payments.reduce(
          (sum, payment) => sum + (payment.type === PaymentType.PAYMENT ? payment.amount : -payment.amount),
          0,
        );
        const paid = order.deposit + additionalPaid;
        const balance = order.status === OrderStatus.CANCELLED ? 0 : Math.max(0, order.total - paid);
        this.formatRow(sheet.addRow([
          order.code,
          order.createdAt,
          order.customer.name,
          order.customer.phone,
          order.items.map((item) => `${item.name} × ${item.qty}`).join('\n'),
          order.dueDate,
          order.total,
          order.deposit,
          additionalPaid,
          paid,
          balance,
          statusLabels[order.status],
          order.warrantyUntil,
          order.note ?? '',
        ]));
      }
      cursor = orders.length === 500 ? orders[orders.length - 1].id : undefined;
    } while (cursor);
    sheet.commit();
    await workbook.commit();
  }

  private async createWhere(query: OrderQueryDto & { ids?: string[] }): Promise<Prisma.OrderWhereInput> {
    if (query.ids?.length) return { id: { in: query.ids } };

    const q = query.q?.trim();
    const dateFrom = query.dateFrom ? new Date(`${query.dateFrom}T00:00:00.000+07:00`) : undefined;
    const dateTo = query.dateTo ? new Date(`${query.dateTo}T23:59:59.999+07:00`) : undefined;
    if (dateFrom && dateTo && dateFrom > dateTo) throw new BadRequestException('Ngày bắt đầu không được sau ngày kết thúc.');
    const where: Prisma.OrderWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      archivedAt: query.archiveView === 'ARCHIVED' ? { not: null } : null,
      ...(query.status ? { status: query.status } : query.archiveView === 'ARCHIVED' ? {} : { status: { not: OrderStatus.CANCELLED } }),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { customer: { name: { contains: q, mode: 'insensitive' } } },
              { customer: { phone: { contains: q } } },
              {
                items: {
                  some: {
                    OR: [
                      { name: { contains: q, mode: 'insensitive' } },
                      { product: { sku: { contains: q, mode: 'insensitive' } } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
      ...(dateFrom || dateTo
        ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
        : {}),
    };
    const { start, end } = vietnamDayRange();
    const workFilters: Record<NonNullable<OrderQueryDto['workFilter']>, Prisma.OrderWhereInput> = {
      IN_PROGRESS: { status: OrderStatus.IN_PROGRESS },
      TODAY: { status: { in: [OrderStatus.IN_PROGRESS, OrderStatus.AWAITING_PAYMENT] }, dueDate: { gte: start, lt: end } },
      OVERDUE: { status: { in: [OrderStatus.IN_PROGRESS, OrderStatus.AWAITING_PAYMENT] }, dueDate: { lt: start } },
    };
    const filteredWhere = query.workFilter ? { AND: [where, workFilters[query.workFilter]] } : where;
    if (!query.paymentOutstanding) return filteredWhere;
    return {
      AND: [
        filteredWhere,
        { status: { not: OrderStatus.CANCELLED } },
        { outstandingAmount: { gt: 0 } },
      ],
    };
  }

  private formatRow(row: ExcelJS.Row, header = false): void {
    row.height = header ? 24 : 28;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
      cell.alignment = { vertical: 'middle', wrapText: true };
      if (header) {
        cell.font = { bold: true, color: { argb: 'FF24466E' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF3FF' } };
      }
    });
    row.commit();
  }
}
