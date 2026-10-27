import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus, PaymentMethod, PaymentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';

const timeZone = 'Asia/Ho_Chi_Minh';
const formatDay = (date: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const startOfVietnamDay = (day: string): Date => new Date(`${day}T00:00:00.000+07:00`);
const endOfVietnamDay = (day: string): Date => new Date(`${day}T23:59:59.999+07:00`);
const activeStatuses: OrderStatus[] = [OrderStatus.NEW, OrderStatus.LENS_ORDERED, OrderStatus.PROCESSING, OrderStatus.READY, OrderStatus.DELIVERED];

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(query: ReportQueryDto) {
    const today = formatDay(new Date());
    const monthStart = `${today.slice(0, 8)}01`;
    const dateFrom = query.dateFrom ?? monthStart;
    const dateTo = query.dateTo ?? today;
    if (dateFrom > dateTo) throw new BadRequestException('Ngày bắt đầu không được sau ngày kết thúc.');
    const createdAt = { gte: startOfVietnamDay(dateFrom), lte: endOfVietnamDay(dateTo) };
    const [orders, payments] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { createdAt },
        select: { status: true, total: true, deposit: true, createdAt: true, items: { select: { name: true, qty: true, unitPrice: true } }, payments: { select: { amount: true, type: true } } },
      }),
      this.prisma.payment.findMany({ where: { paidAt: createdAt }, select: { amount: true, method: true, type: true } }),
    ]);
    const activeOrders = orders.filter((order) => activeStatuses.includes(order.status));
    const orderSales = activeOrders.reduce((sum, order) => sum + order.total, 0);
    const outstanding = activeOrders.reduce((sum, order) => sum + Math.max(0, order.total - order.deposit - order.payments.reduce((paid, payment) => paid + (payment.type === PaymentType.PAYMENT ? payment.amount : -payment.amount), 0)), 0);
    const deposits = orders.reduce((sum, order) => sum + order.deposit, 0);
    const paymentCashflow = payments.reduce((sum, payment) => sum + (payment.type === PaymentType.PAYMENT ? payment.amount : -payment.amount), 0);
    const statusCounts = Object.fromEntries(Object.values(OrderStatus).map((status) => [status, orders.filter((order) => order.status === status).length])) as Record<OrderStatus, number>;
    const daily = new Map<string, { sales: number; orders: number }>();
    for (const order of activeOrders) {
      const day = formatDay(order.createdAt);
      const current = daily.get(day) ?? { sales: 0, orders: 0 };
      daily.set(day, { sales: current.sales + order.total, orders: current.orders + 1 });
    }
    const productMap = new Map<string, { qty: number; sales: number }>();
    for (const order of activeOrders) for (const item of order.items) {
      const current = productMap.get(item.name) ?? { qty: 0, sales: 0 };
      productMap.set(item.name, { qty: current.qty + item.qty, sales: current.sales + item.unitPrice * item.qty });
    }
    const paymentByMethod = Object.fromEntries(Object.values(PaymentMethod).map((method) => [method, 0])) as Record<PaymentMethod, number>;
    for (const payment of payments) paymentByMethod[payment.method] += payment.type === PaymentType.PAYMENT ? payment.amount : -payment.amount;
    return {
      period: { dateFrom, dateTo },
      summary: { orderSales, collected: deposits + paymentCashflow, outstanding, orderCount: activeOrders.length, actionNeeded: statusCounts.NEW + statusCounts.LENS_ORDERED + statusCounts.PROCESSING },
      dailySales: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, ...value })),
      statusCounts,
      paymentByMethod,
      topProducts: [...productMap.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.sales - a.sales).slice(0, 5),
    };
  }

  async dashboard() {
    const today = formatDay(new Date());
    const todayRange = { gte: startOfVietnamDay(today), lte: endOfVietnamDay(today) };
    const sevenDayStart = formatDay(new Date(startOfVietnamDay(today).getTime() - 6 * 24 * 60 * 60 * 1000));
    const actionStatuses: OrderStatus[] = [OrderStatus.NEW, OrderStatus.LENS_ORDERED, OrderStatus.PROCESSING];
    const dueStatuses: OrderStatus[] = [...actionStatuses, OrderStatus.READY];
    const [activeOrders, todayOrders, todayPayments, recentOrders, weekOrders, newOrders, actionNeeded, dueToday, overdue] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where: { status: { in: activeStatuses } }, select: { total: true, deposit: true, payments: { select: { amount: true, type: true } } } }),
      this.prisma.order.findMany({ where: { createdAt: todayRange }, select: { deposit: true } }),
      this.prisma.payment.findMany({ where: { paidAt: todayRange }, select: { amount: true, type: true } }),
      this.prisma.order.findMany({ where: { status: { in: activeStatuses } }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, code: true, status: true, total: true, dueDate: true, createdAt: true, customer: { select: { name: true, phone: true } } } }),
      this.prisma.order.findMany({ where: { status: { in: activeStatuses }, createdAt: { gte: startOfVietnamDay(sevenDayStart), lte: endOfVietnamDay(today) } }, select: { createdAt: true, total: true } }),
      this.prisma.order.count({ where: { status: { in: activeStatuses }, createdAt: todayRange } }),
      this.prisma.order.count({ where: { status: { in: actionStatuses } } }),
      this.prisma.order.count({ where: { status: { in: dueStatuses }, dueDate: todayRange } }),
      this.prisma.order.count({ where: { status: { in: dueStatuses }, dueDate: { lt: startOfVietnamDay(today) } } }),
    ]);
    const outstanding = activeOrders.reduce((sum, order) => sum + Math.max(0, order.total - order.deposit - order.payments.reduce((paid, payment) => paid + (payment.type === PaymentType.PAYMENT ? payment.amount : -payment.amount), 0)), 0);
    const collectedToday = todayOrders.reduce((sum, order) => sum + order.deposit, 0) + todayPayments.reduce((sum, payment) => sum + (payment.type === PaymentType.PAYMENT ? payment.amount : -payment.amount), 0);
    const daily = new Map<string, number>();
    for (const order of weekOrders) daily.set(formatDay(order.createdAt), (daily.get(formatDay(order.createdAt)) ?? 0) + order.total);
    return {
      today,
      summary: { collectedToday, newOrders, outstanding, actionNeeded },
      tasks: { overdue, dueToday, actionNeeded },
      recentOrders,
      dailySales: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, sales]) => ({ date, sales })),
    };
  }
}
