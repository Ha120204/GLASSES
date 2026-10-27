import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, OrderType, PaymentType, Prisma, type EyeExam } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

const orderInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  createdBy: { select: { id: true, name: true } },
  items: { select: { id: true, productId: true, name: true, unitPrice: true, qty: true, product: { select: { id: true, sku: true, barcode: true, name: true, type: true, brand: true, costPrice: true, salePrice: true, supplier: true, active: true, deletedAt: true } } } },
  payments: { select: { id: true, amount: true, method: true, type: true, paidAt: true, note: true, createdBy: { select: { id: true, name: true } } }, orderBy: { paidAt: 'desc' } },
  statusHistory: { select: { id: true, fromStatus: true, toStatus: true, createdAt: true, createdBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
} as const;

const validStatusTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.NEW]: [OrderStatus.LENS_ORDERED, OrderStatus.PROCESSING, OrderStatus.READY],
  [OrderStatus.LENS_ORDERED]: [OrderStatus.PROCESSING, OrderStatus.READY],
  [OrderStatus.PROCESSING]: [OrderStatus.READY],
  [OrderStatus.READY]: [OrderStatus.PROCESSING, OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};
const activeStatuses: OrderStatus[] = [OrderStatus.NEW, OrderStatus.LENS_ORDERED, OrderStatus.PROCESSING, OrderStatus.READY];
const actionNeededStatuses: OrderStatus[] = [OrderStatus.NEW, OrderStatus.LENS_ORDERED, OrderStatus.PROCESSING];
const vietnamDayRange = (): { start: Date; end: Date } => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const day = ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value ?? '').join('-');
  const start = new Date(`${day}T00:00:00.000+07:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: OrderQueryDto) {
    const q = query.q?.trim();
    const dateFrom = query.dateFrom ? new Date(`${query.dateFrom}T00:00:00.000+07:00`) : undefined;
    const dateTo = query.dateTo ? new Date(`${query.dateTo}T23:59:59.999+07:00`) : undefined;
    if (dateFrom && dateTo && dateFrom > dateTo) throw new BadRequestException('Ngày bắt đầu không được sau ngày kết thúc.');
    let where: Prisma.OrderWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.status ? { status: query.status } : { status: { not: OrderStatus.CANCELLED } }),
      ...(q ? { OR: [{ code: { contains: q, mode: 'insensitive' } }, { customer: { name: { contains: q, mode: 'insensitive' } } }, { customer: { phone: { contains: q } } }, { items: { some: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { product: { sku: { contains: q, mode: 'insensitive' } } }] } } }] } : {}),
      ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
    };
    if (query.workFilter) {
      const { start, end } = vietnamDayRange();
      const workConditions: Record<NonNullable<OrderQueryDto['workFilter']>, Prisma.OrderWhereInput> = {
        ACTION_NEEDED: { status: { in: actionNeededStatuses } },
        TODAY: { status: { in: activeStatuses }, dueDate: { gte: start, lt: end } },
        OVERDUE: { status: { in: activeStatuses }, dueDate: { lt: start } },
      };
      where = { AND: [where, workConditions[query.workFilter]] };
    }
    if (query.paymentOutstanding) {
      where = { AND: [where, { status: { not: OrderStatus.CANCELLED } }] };
      const candidates = await this.prisma.order.findMany({ where, select: { id: true, total: true, deposit: true, payments: { select: { amount: true, type: true } } } });
      where = { ...where, id: { in: candidates.filter((order) => this.outstandingBalance(order) > 0).map((order) => order.id) } };
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: query.sortDirection }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async statusCounts() {
    const orders = await this.prisma.order.findMany({ select: { status: true, dueDate: true, total: true, deposit: true, payments: { select: { amount: true, type: true } } } });
    const { start, end } = vietnamDayRange();
    const activeOrders = orders.filter((order) => activeStatuses.includes(order.status));
    return {
      total: orders.length,
      byStatus: Object.fromEntries(Object.values(OrderStatus).map((status) => [status, orders.filter((order) => order.status === status).length])) as Record<OrderStatus, number>,
      work: {
        outstanding: orders.filter((order) => order.status !== OrderStatus.CANCELLED && this.outstandingBalance(order) > 0).length,
        actionNeeded: orders.filter((order) => actionNeededStatuses.includes(order.status)).length,
        today: activeOrders.filter((order) => order.dueDate && order.dueDate >= start && order.dueDate < end).length,
        overdue: activeOrders.filter((order) => order.dueDate && order.dueDate < start).length,
      },
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    return order;
  }

  async create(dto: CreateOrderDto, createdById: string) {
    const quantities = this.aggregateItems(dto);
    return this.prisma.$transaction(async (transaction) => {
      const customer = await transaction.customer.findFirst({ where: { id: dto.customerId, deletedAt: null } });
      if (!customer) throw new NotFoundException('Khách hàng không tồn tại hoặc đã bị xóa.');
      const eyeExam = await this.findEyeExam(transaction, dto.customerId, dto.eyeExamId);
      const products = await transaction.product.findMany({ where: { id: { in: [...quantities.keys()] }, deletedAt: null, active: true } });
      if (products.length !== quantities.size) throw new BadRequestException('Có sản phẩm không tồn tại hoặc đã ngừng kinh doanh.');
      this.assertPrescription(products, eyeExam);
      const productById = new Map(products.map((product) => [product.id, product]));
      const subtotal = [...quantities].reduce((sum, [productId, qty]) => sum + productById.get(productId)!.salePrice * qty, 0);
      const { discount, total, deposit } = this.resolveAmounts(dto, subtotal);
      const orderType = dto.orderType ?? OrderType.PREORDER;
      if (orderType === OrderType.READY_SALE && deposit !== total) throw new BadRequestException('Đơn bán hàng có sẵn phải thanh toán đủ khi tạo đơn.');
      const initialStatus = orderType === OrderType.READY_SALE ? OrderStatus.DELIVERED : OrderStatus.NEW;
      return transaction.order.create({ data: { code: this.createCode(), customerId: customer.id, createdById, eyeExamId: dto.eyeExamId || null, prescriptionSnapshot: eyeExam ? this.createPrescriptionSnapshot(eyeExam) : Prisma.JsonNull, orderType, status: initialStatus, subtotal, discount, total, deposit, depositMethod: deposit > 0 ? (dto.depositMethod ?? 'CASH') : null, dueDate: orderType === OrderType.PREORDER && dto.dueDate ? new Date(dto.dueDate) : null, warrantyUntil: dto.warrantyUntil ? new Date(dto.warrantyUntil) : null, note: dto.note?.trim() || null, items: { create: [...quantities].map(([productId, qty]) => ({ productId, name: productById.get(productId)!.name, unitPrice: productById.get(productId)!.salePrice, qty })) }, statusHistory: { create: { toStatus: initialStatus, createdById } } }, include: orderInclude });
    });
  }

  async update(id: string, dto: UpdateOrderDto) {
    const quantities = this.aggregateItems(dto);
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({ where: { id }, include: { items: true, payments: { select: { amount: true, type: true } } } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DELIVERED) throw new ConflictException('Không thể sửa đơn đã hủy hoặc đã giao.');
      const customer = await transaction.customer.findFirst({ where: { id: dto.customerId, deletedAt: null } });
      if (!customer) throw new NotFoundException('Khách hàng không tồn tại hoặc đã bị xóa.');
      const eyeExam = await this.findEyeExam(transaction, dto.customerId, dto.eyeExamId);
      const products = await transaction.product.findMany({ where: { id: { in: [...quantities.keys()] }, deletedAt: null } });
      if (products.length !== quantities.size) throw new BadRequestException('Có sản phẩm không còn tồn tại.');
      const previousItems = new Map(order.items.map((item) => [item.productId, item]));
      for (const product of products) if (!product.active && !previousItems.has(product.id)) throw new BadRequestException(`Sản phẩm “${product.name}” đã ngừng kinh doanh.`);
      this.assertPrescription(products, eyeExam);
      const productById = new Map(products.map((product) => [product.id, product]));
      const subtotal = [...quantities].reduce((sum, [productId, qty]) => sum + (previousItems.get(productId)?.unitPrice ?? productById.get(productId)!.salePrice) * qty, 0);
      const discount = dto.discount ?? 0;
      if (discount > subtotal) throw new BadRequestException('Chiết khấu không được lớn hơn tạm tính.');
      const total = subtotal - discount;
      const paid = order.deposit + order.payments.reduce((sum, payment) => sum + (payment.type === PaymentType.PAYMENT ? payment.amount : -payment.amount), 0);
      if (total < paid) throw new BadRequestException('Tổng đơn sau khi sửa không được thấp hơn số tiền đã nhận. Hãy hoàn tiền bằng quy trình riêng.');
      return transaction.order.update({ where: { id }, data: { customerId: customer.id, eyeExamId: dto.eyeExamId || null, prescriptionSnapshot: eyeExam ? this.createPrescriptionSnapshot(eyeExam) : Prisma.JsonNull, subtotal, discount, total, dueDate: dto.dueDate ? new Date(dto.dueDate) : null, warrantyUntil: dto.warrantyUntil ? new Date(dto.warrantyUntil) : null, note: dto.note?.trim() || null, items: { deleteMany: {}, create: [...quantities].map(([productId, qty]) => ({ productId, name: productById.get(productId)!.name, unitPrice: previousItems.get(productId)?.unitPrice ?? productById.get(productId)!.salePrice, qty })) } }, include: orderInclude });
    });
  }

  async cancel(id: string, dto: CancelOrderDto, cancelledById: string) {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({ where: { id }, include: { payments: { select: { amount: true, type: true } } } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (order.status === OrderStatus.CANCELLED) throw new ConflictException('Đơn hàng đã hủy.');
      const paid = order.deposit + order.payments.reduce((sum, payment) => sum + (payment.type === PaymentType.PAYMENT ? payment.amount : -payment.amount), 0);
      if (paid > 0 && !dto.refundMethod) throw new BadRequestException('Chọn hình thức hoàn tiền trước khi hủy đơn.');
      if (paid > 0) await transaction.payment.create({ data: { orderId: order.id, amount: paid, method: dto.refundMethod!, type: PaymentType.REFUND, note: `Hoàn tiền khi hủy đơn: ${dto.reason.trim()}`, createdById: cancelledById } });
      return transaction.order.update({ where: { id }, data: { status: OrderStatus.CANCELLED, cancellationReason: dto.reason.trim(), cancelledAt: new Date(), cancelledById, statusHistory: { create: { fromStatus: order.status, toStatus: OrderStatus.CANCELLED, createdById: cancelledById } } }, include: orderInclude });
    });
  }

  async createPayment(id: string, dto: CreateOrderPaymentDto, createdById: string) {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({ where: { id }, include: { payments: { select: { amount: true, type: true } } } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (order.status === OrderStatus.CANCELLED) throw new ConflictException('Không thể ghi nhận thanh toán cho đơn đã hủy.');
      const paid = order.deposit + order.payments.reduce((sum, payment) => sum + (payment.type === PaymentType.PAYMENT ? payment.amount : -payment.amount), 0);
      if (dto.amount > order.total - paid) throw new BadRequestException('Số tiền thanh toán vượt quá số tiền còn lại của đơn.');
      return transaction.payment.create({ data: { orderId: id, amount: dto.amount, method: dto.method, note: dto.note?.trim() || null, createdById } });
    });
  }

  async updateStatus(id: string, status: OrderStatus, changedById: string) {
    if (status === OrderStatus.CANCELLED) throw new BadRequestException('Dùng thao tác hủy đơn để hủy và hoàn tiền đúng quy trình.');
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({ where: { id }, select: { status: true } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (order.status === status) return transaction.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
      if (!validStatusTransitions[order.status].includes(status)) throw new ConflictException('Không thể chuyển đơn hàng sang trạng thái này.');
      return transaction.order.update({ where: { id }, data: { status, statusHistory: { create: { fromStatus: order.status, toStatus: status, createdById: changedById } } }, include: orderInclude });
    });
  }

  async bulkUpdateStatus(ids: string[], status: OrderStatus, changedById: string) {
    if (status === OrderStatus.CANCELLED) throw new BadRequestException('Không thể hủy nhiều đơn cùng lúc. Hãy hủy từng đơn để kiểm tra hoàn tiền.');
    const uniqueIds = [...new Set(ids)];
    return this.prisma.$transaction(async (transaction) => {
      const orders = await transaction.order.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, code: true, status: true } });
      if (orders.length !== uniqueIds.length) throw new NotFoundException('Có đơn hàng không còn tồn tại. Hãy tải lại danh sách.');
      const invalidOrder = orders.find((order) => !validStatusTransitions[order.status].includes(status));
      if (invalidOrder) throw new ConflictException(`Không thể chuyển đơn ${invalidOrder.code} sang trạng thái đã chọn.`);
      await Promise.all(orders.map((order) => transaction.order.update({ where: { id: order.id }, data: { status, statusHistory: { create: { fromStatus: order.status, toStatus: status, createdById: changedById } } } })));
      return { count: orders.length };
    });
  }

  private async findEyeExam(client: Prisma.TransactionClient, customerId: string, eyeExamId?: string | null) {
    if (!eyeExamId) return null;
    const eyeExam = await client.eyeExam.findFirst({ where: { id: eyeExamId, customerId, archivedAt: null, lockedAt: { not: null } } });
    if (!eyeExam) throw new BadRequestException('Chỉ có thể dùng phiếu đo đã chốt của khách hàng đã chọn.');
    return eyeExam;
  }

  private assertPrescription(products: Array<{ type: string }>, eyeExam: EyeExam | null): void {
    if (products.some((product) => product.type === 'LENS' || product.type === 'CONTACT') && !eyeExam) throw new BadRequestException('Đơn có tròng kính hoặc kính áp tròng phải chọn phiếu đo mắt.');
  }

  private resolveAmounts(dto: CreateOrderDto, subtotal: number) {
    const discount = dto.discount ?? 0;
    if (discount > subtotal) throw new BadRequestException('Chiết khấu không được lớn hơn tạm tính.');
    const total = subtotal - discount;
    const deposit = dto.deposit ?? 0;
    if (deposit > total) throw new BadRequestException('Tiền cọc không được lớn hơn tổng đơn.');
    return { discount, total, deposit };
  }

  private aggregateItems(dto: CreateOrderDto): Map<string, number> {
    const quantities = new Map<string, number>();
    for (const item of dto.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.qty);
    return quantities;
  }

  private outstandingBalance(order: { total: number; deposit: number; payments: Array<{ amount: number; type: PaymentType }> }): number {
    return order.total - order.deposit - order.payments.reduce((sum, payment) => sum + (payment.type === PaymentType.PAYMENT ? payment.amount : -payment.amount), 0);
  }

  private createPrescriptionSnapshot(eyeExam: EyeExam): Prisma.InputJsonValue {
    const toNumber = (value: Prisma.Decimal | null): number | null => value?.toNumber() ?? null;
    return { sourceEyeExamId: eyeExam.id, examDate: eyeExam.examDate.toISOString(), rSph: toNumber(eyeExam.rSph), rCyl: toNumber(eyeExam.rCyl), rAxis: eyeExam.rAxis, rAdd: toNumber(eyeExam.rAdd), rPd: toNumber(eyeExam.rPd), pdTotal: toNumber(eyeExam.pdTotal), rPrism: toNumber(eyeExam.rPrism), rBase: eyeExam.rBase, rSegHeight: toNumber(eyeExam.rSegHeight), lSph: toNumber(eyeExam.lSph), lCyl: toNumber(eyeExam.lCyl), lAxis: eyeExam.lAxis, lAdd: toNumber(eyeExam.lAdd), lPd: toNumber(eyeExam.lPd), lPrism: toNumber(eyeExam.lPrism), lBase: eyeExam.lBase, lSegHeight: toNumber(eyeExam.lSegHeight), wearingPurpose: eyeExam.wearingPurpose, lensDesign: eyeExam.lensDesign, noPrescription: eyeExam.noPrescription, noPrescriptionReason: eyeExam.noPrescriptionReason };
  }

  private createCode(): string {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const date = ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value ?? '').join('');
    return `DH-${date}-${randomUUID().slice(0, 6).toUpperCase()}`;
  }
}
