import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderAuditAction, OrderStatus, OrderType, PaymentMethod, PaymentType, Prisma, type EyeExam } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CancelOrderDto, refundAccountNamePattern } from './dto/cancel-order.dto';
import { ConfirmOrderRefundDto } from './dto/confirm-order-refund.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

const orderInclude = {
  customer: { select: { id: true, name: true, phone: true, address: true } },
  createdBy: { select: { id: true, name: true } },
  archivedBy: { select: { id: true, name: true } },
  items: { select: { id: true, productId: true, name: true, unitPrice: true, qty: true, product: { select: { id: true, sku: true, name: true, type: true, brand: true, salePrice: true, active: true, imageUpdatedAt: true } } } },
  payments: { select: { id: true, amount: true, method: true, type: true, paidAt: true, note: true, reference: true, createdBy: { select: { id: true, name: true } } }, orderBy: { paidAt: 'desc' } },
  statusHistory: { select: { id: true, fromStatus: true, toStatus: true, createdAt: true, createdBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
} as const;

const orderDetailInclude = {
  ...orderInclude,
  auditLogs: {
    select: {
      id: true,
      action: true,
      changes: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
} as const;

type OrderAuditSnapshot = {
  customerId: string;
  eyeExamId: string | null;
  subtotal: number;
  discount: number;
  total: number;
  dueDate: Date | null;
  warrantyUntil: Date | null;
  note: string | null;
  items: Array<{ productId: string | null; name: string; unitPrice: number; qty: number }>;
};

const validStatusTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.IN_PROGRESS]: [OrderStatus.DELIVERED],
  [OrderStatus.AWAITING_PAYMENT]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};
const activeStatuses: OrderStatus[] = [OrderStatus.IN_PROGRESS, OrderStatus.AWAITING_PAYMENT];
const inProgressStatuses: OrderStatus[] = [OrderStatus.IN_PROGRESS];
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
      archivedAt: query.archiveView === 'ARCHIVED' ? { not: null } : null,
      ...(query.status ? { status: query.status } : {}),
      ...(q ? { OR: [{ code: { contains: q, mode: 'insensitive' } }, { customer: { name: { contains: q, mode: 'insensitive' } } }, { customer: { phone: { contains: q } } }, { items: { some: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { product: { sku: { contains: q, mode: 'insensitive' } } }] } } }] } : {}),
      ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
    };
    if (!query.status && query.archiveView !== 'ARCHIVED') where = { AND: [where, { OR: [{ status: { not: OrderStatus.CANCELLED } }, { refundPendingAmount: { gt: 0 } }] }] };
    if (query.workFilter) {
      const { start, end } = vietnamDayRange();
      const workConditions: Record<NonNullable<OrderQueryDto['workFilter']>, Prisma.OrderWhereInput> = {
        IN_PROGRESS: { status: { in: inProgressStatuses } },
        TODAY: { status: { in: activeStatuses }, dueDate: { gte: start, lt: end } },
        OVERDUE: { status: { in: activeStatuses }, dueDate: { lt: start } },
      };
      where = { AND: [where, workConditions[query.workFilter]] };
    }
    if (query.paymentOutstanding) {
      where = {
        AND: [
          where,
          { status: { not: OrderStatus.CANCELLED } },
          { outstandingAmount: { gt: 0 } },
        ],
      };
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: query.sortDirection }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async statusCounts(customerId?: string) {
    const scope: Prisma.OrderWhereInput = { archivedAt: null, ...(customerId ? { customerId } : {}) };
    const { start, end } = vietnamDayRange();
    const statuses = Object.values(OrderStatus);
    const [total, byStatusCounts, outstanding, inProgress, today, overdue] = await Promise.all([
      this.prisma.order.count({ where: scope }),
      Promise.all(statuses.map((status) => this.prisma.order.count({ where: { ...scope, status } }))),
      this.prisma.order.count({ where: { ...scope, status: { not: OrderStatus.CANCELLED }, outstandingAmount: { gt: 0 } } }),
      this.prisma.order.count({ where: { ...scope, status: OrderStatus.IN_PROGRESS } }),
      this.prisma.order.count({ where: { ...scope, status: { in: activeStatuses }, dueDate: { gte: start, lt: end } } }),
      this.prisma.order.count({ where: { ...scope, status: { in: activeStatuses }, dueDate: { lt: start } } }),
    ]);
    return {
      total,
      byStatus: Object.fromEntries(statuses.map((status, index) => [status, byStatusCounts[index]])) as Record<OrderStatus, number>,
      work: { outstanding, inProgress, today, overdue },
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderDetailInclude });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    return order;
  }

  async create(dto: CreateOrderDto, createdById: string) {
    const requestHash = this.hashRequest(dto);
    const previous = await this.prisma.order.findUnique({ where: { idempotencyKey: dto.idempotencyKey }, include: orderInclude });
    if (previous) {
      if (previous.requestHash !== requestHash) throw new ConflictException('Mã yêu cầu đã được dùng cho nội dung khác.');
      return previous;
    }
    const quantities = this.aggregateItems(dto);
    try {
      return await this.prisma.$transaction(async (transaction) => {
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
        const awaitingTransferPayment = dto.awaitingTransferPayment === true;
        if (awaitingTransferPayment && (orderType !== OrderType.READY_SALE || dto.depositMethod !== 'TRANSFER' || deposit !== 0)) throw new BadRequestException('Đơn chờ thanh toán chỉ áp dụng cho bán giao ngay qua chuyển khoản và chưa ghi nhận tiền.');
        if (orderType === OrderType.READY_SALE && !awaitingTransferPayment && deposit !== total) throw new BadRequestException('Đơn bán hàng có sẵn phải thanh toán đủ khi tạo đơn.');
        const initialStatus = awaitingTransferPayment ? OrderStatus.AWAITING_PAYMENT : orderType === OrderType.READY_SALE ? OrderStatus.DELIVERED : OrderStatus.IN_PROGRESS;
        return transaction.order.create({ data: { code: this.createCode(), idempotencyKey: dto.idempotencyKey, requestHash, customerId: customer.id, createdById, eyeExamId: dto.eyeExamId || null, prescriptionSnapshot: eyeExam ? this.createPrescriptionSnapshot(eyeExam) : Prisma.JsonNull, orderType, status: initialStatus, subtotal, discount, total, deposit, outstandingAmount: total - deposit, depositMethod: deposit > 0 ? (dto.depositMethod ?? 'CASH') : null, dueDate: orderType === OrderType.PREORDER && dto.dueDate ? new Date(dto.dueDate) : null, warrantyUntil: dto.warrantyUntil ? new Date(dto.warrantyUntil) : null, note: dto.note?.trim() || null, items: { create: [...quantities].map(([productId, qty]) => ({ productId, name: productById.get(productId)!.name, unitPrice: productById.get(productId)!.salePrice, qty })) }, statusHistory: { create: { toStatus: initialStatus, createdById } } }, include: orderInclude });
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await this.prisma.order.findUnique({ where: { idempotencyKey: dto.idempotencyKey }, include: orderInclude });
        if (duplicate) {
          if (duplicate.requestHash !== requestHash) throw new ConflictException('Mã yêu cầu đã được dùng cho nội dung khác.');
          return duplicate;
        }
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateOrderDto, updatedById: string) {
    const quantities = this.aggregateItems(dto);
    return this.prisma.$transaction(async (transaction) => {
      // The order total is compared with recorded payments below. Lock the parent order first so
      // a concurrent payment cannot make that comparison stale before this update is committed.
      await this.lockOrderForFinancialMutation(transaction, id);
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
      const updated = await transaction.order.update({ where: { id }, data: { customerId: customer.id, eyeExamId: dto.eyeExamId || null, prescriptionSnapshot: eyeExam ? this.createPrescriptionSnapshot(eyeExam) : Prisma.JsonNull, subtotal, discount, total, outstandingAmount: total - paid, dueDate: dto.dueDate ? new Date(dto.dueDate) : null, warrantyUntil: dto.warrantyUntil ? new Date(dto.warrantyUntil) : null, note: dto.note?.trim() || null, items: { deleteMany: {}, create: [...quantities].map(([productId, qty]) => ({ productId, name: productById.get(productId)!.name, unitPrice: previousItems.get(productId)?.unitPrice ?? productById.get(productId)!.salePrice, qty })) } }, include: orderInclude });
      const changes = this.getUpdateChanges(order, updated);
      if (Object.keys(changes).length) {
        await transaction.orderAuditLog.create({
          data: { orderId: order.id, action: OrderAuditAction.UPDATED, changes, createdById: updatedById },
        });
      }
      return updated;
    });
  }

  async cancel(id: string, dto: CancelOrderDto, cancelledById: string) {
    return this.prisma.$transaction(async (transaction) => {
      // Cancellation records a refund obligation; money is recorded only after it is actually returned.
      await this.lockOrderForFinancialMutation(transaction, id);
      const order = await transaction.order.findUnique({ where: { id }, include: { payments: { select: { amount: true, type: true } } } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (order.status === OrderStatus.CANCELLED) throw new ConflictException('Đơn hàng đã hủy.');
      if (order.status === OrderStatus.DELIVERED) throw new ConflictException('Không thể hủy đơn đã giao.');
      const paid = order.deposit + order.payments.reduce((sum, payment) => sum + (payment.type === PaymentType.PAYMENT ? payment.amount : -payment.amount), 0);
      if (paid > 0 && !dto.refundMethod) throw new BadRequestException('Chọn hình thức hoàn tiền trước khi hủy đơn.');
      if (paid > 0 && dto.refundMethod === PaymentMethod.TRANSFER && (!dto.refundBankName?.trim() || !dto.refundAccountNumber?.trim() || !dto.refundAccountName?.trim())) {
        throw new BadRequestException('Nhập đủ ngân hàng, số tài khoản và tên chủ tài khoản để hoàn tiền chuyển khoản.');
      }
      if (paid > 0 && dto.refundMethod === PaymentMethod.TRANSFER && !refundAccountNamePattern.test(dto.refundAccountName!.trim())) {
        throw new BadRequestException('Tên chủ tài khoản phải có chữ và không được chứa số.');
      }
      return transaction.order.update({ where: { id }, data: { status: OrderStatus.CANCELLED, outstandingAmount: 0, cancellationReason: dto.reason.trim(), cancelledAt: new Date(), cancelledById, refundPendingAmount: Math.max(0, paid), refundMethod: paid > 0 ? dto.refundMethod : null, refundBankName: paid > 0 && dto.refundMethod === PaymentMethod.TRANSFER ? dto.refundBankName!.trim() : null, refundAccountNumber: paid > 0 && dto.refundMethod === PaymentMethod.TRANSFER ? dto.refundAccountNumber!.trim() : null, refundAccountName: paid > 0 && dto.refundMethod === PaymentMethod.TRANSFER ? dto.refundAccountName!.trim() : null, statusHistory: { create: { fromStatus: order.status, toStatus: OrderStatus.CANCELLED, createdById: cancelledById } } }, include: orderInclude });
    });
  }

  async confirmRefund(id: string, dto: ConfirmOrderRefundDto, refundedById: string) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockOrderForFinancialMutation(transaction, id);
      const order = await transaction.order.findUnique({ where: { id }, select: { status: true, refundPendingAmount: true, refundMethod: true, archivedAt: true } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (order.status !== OrderStatus.CANCELLED || order.refundPendingAmount <= 0 || !order.refundMethod || order.archivedAt) {
        throw new ConflictException('Đơn không có khoản hoàn tiền đang chờ xử lý.');
      }
      if (!dto.confirmed) throw new BadRequestException('Chỉ ghi nhận sau khi đã trả tiền cho khách.');
      const reference = dto.reference?.trim();
      if (order.refundMethod === PaymentMethod.TRANSFER && !reference) throw new BadRequestException('Nhập mã giao dịch chuyển khoản sau khi đã hoàn tiền.');
      await transaction.payment.create({ data: { orderId: id, amount: order.refundPendingAmount, method: order.refundMethod, type: PaymentType.REFUND, reference: reference || null, note: dto.note?.trim() || 'Hoàn tiền sau khi hủy đơn', createdById: refundedById } });
      return transaction.order.update({ where: { id }, data: { refundPendingAmount: 0 }, include: orderInclude });
    });
  }

  async archive(id: string, archivedById: string) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockOrderForFinancialMutation(transaction, id);
      const order = await transaction.order.findUnique({ where: { id }, select: { status: true, outstandingAmount: true, archivedAt: true, refundPendingAmount: true } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (order.archivedAt) throw new ConflictException('Đơn hàng đã được lưu trữ.');
      if (order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.CANCELLED) {
        throw new ConflictException('Chỉ có thể lưu trữ đơn đã giao hoặc đã hủy.');
      }
      if (order.outstandingAmount !== 0) throw new ConflictException('Không thể lưu trữ đơn còn phải thu.');
      if (order.refundPendingAmount > 0) throw new ConflictException('Hoàn tiền cho khách trước khi lưu trữ đơn.');
      const archived = await transaction.order.update({
        where: { id },
        data: { archivedAt: new Date(), archivedById },
        include: orderInclude,
      });
      await transaction.orderAuditLog.create({ data: { orderId: id, action: OrderAuditAction.ARCHIVED, createdById: archivedById } });
      return archived;
    });
  }

  async restore(id: string, restoredById: string) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockOrderForFinancialMutation(transaction, id);
      const order = await transaction.order.findUnique({ where: { id }, select: { archivedAt: true } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (!order.archivedAt) throw new ConflictException('Đơn hàng chưa được lưu trữ.');
      const restored = await transaction.order.update({
        where: { id },
        data: { archivedAt: null, archivedById: null },
        include: orderInclude,
      });
      await transaction.orderAuditLog.create({ data: { orderId: id, action: OrderAuditAction.RESTORED, createdById: restoredById } });
      return restored;
    });
  }

  async permanentlyDelete(id: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await this.lockOrderForFinancialMutation(transaction, id);
      const order = await transaction.order.findUnique({ where: { id }, select: { status: true, archivedAt: true, refundPendingAmount: true } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (order.status !== OrderStatus.CANCELLED) throw new ConflictException('Chỉ có thể xóa vĩnh viễn đơn đã hủy.');
      if (!order.archivedAt) throw new ConflictException('Hãy lưu trữ đơn đã hủy trước khi xóa vĩnh viễn.');
      if (order.refundPendingAmount > 0) throw new ConflictException('Hoàn tiền cho khách trước khi xóa vĩnh viễn đơn.');
      await transaction.order.delete({ where: { id } });
    });
  }

  async createPayment(id: string, dto: CreateOrderPaymentDto, createdById: string) {
    const requestHash = this.hashRequest({ id, ...dto });
    const previous = await this.prisma.payment.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
    if (previous) {
      if (previous.requestHash !== requestHash) throw new ConflictException('Mã yêu cầu đã được dùng cho nội dung khác.');
      return previous;
    }
    return this.prisma.$transaction(async (transaction) => {
      // `findUnique` alone does not lock the row. Without this lock, two concurrent requests can
      // both read the same balance, pass validation, and create payments that exceed the order total.
      await this.lockOrderForFinancialMutation(transaction, id);
      const duplicate = await transaction.payment.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
      if (duplicate) {
        if (duplicate.requestHash !== requestHash) throw new ConflictException('Mã yêu cầu đã được dùng cho nội dung khác.');
        return duplicate;
      }
      const order = await transaction.order.findUnique({ where: { id }, include: { payments: { select: { amount: true, type: true } } } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (order.status === OrderStatus.CANCELLED) throw new ConflictException('Không thể ghi nhận thanh toán cho đơn đã hủy.');
      const paid = order.deposit + order.payments.reduce((sum, payment) => sum + (payment.type === PaymentType.PAYMENT ? payment.amount : -payment.amount), 0);
      if (dto.amount > order.total - paid) throw new BadRequestException('Số tiền thanh toán vượt quá số tiền còn lại của đơn.');
      if (order.status === OrderStatus.AWAITING_PAYMENT && (dto.method !== PaymentMethod.TRANSFER || dto.amount !== order.total - paid)) {
        throw new BadRequestException('Đơn chờ thanh toán QR cần nhận đủ số tiền còn lại bằng chuyển khoản.');
      }
      const payment = await transaction.payment.create({ data: { orderId: id, idempotencyKey: dto.idempotencyKey, requestHash, amount: dto.amount, method: dto.method, note: dto.note?.trim() || null, createdById } });
      if (order.status === OrderStatus.AWAITING_PAYMENT && paid + dto.amount === order.total) {
        await transaction.order.update({ where: { id }, data: { status: OrderStatus.DELIVERED, outstandingAmount: 0, statusHistory: { create: { fromStatus: OrderStatus.AWAITING_PAYMENT, toStatus: OrderStatus.DELIVERED, createdById } } } });
      } else {
        await transaction.order.update({ where: { id }, data: { outstandingAmount: order.total - paid - dto.amount } });
      }
      return payment;
    });
  }

  async updateStatus(id: string, status: OrderStatus, changedById: string) {
    if (status === OrderStatus.CANCELLED) throw new BadRequestException('Dùng thao tác hủy đơn để hủy và hoàn tiền đúng quy trình.');
    return this.prisma.$transaction(async (transaction) => {
      // Delivery is allowed only after payment is complete, so use the same lock as payment collection.
      await this.lockOrderForFinancialMutation(transaction, id);
      const order = await transaction.order.findUnique({ where: { id }, select: { status: true, total: true, deposit: true, payments: { select: { amount: true, type: true } } } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (order.status === status) return transaction.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
      if (!validStatusTransitions[order.status].includes(status)) throw new ConflictException('Không thể chuyển đơn hàng sang trạng thái này.');
      if (status === OrderStatus.DELIVERED && this.outstandingBalance(order) > 0) throw new ConflictException('Cần ghi nhận thanh toán đủ trước khi chuyển đơn sang trạng thái đã giao.');
      return transaction.order.update({ where: { id }, data: { status, statusHistory: { create: { fromStatus: order.status, toStatus: status, createdById: changedById } } }, include: orderInclude });
    });
  }

  async bulkUpdateStatus(ids: string[], status: OrderStatus, changedById: string) {
    if (status === OrderStatus.CANCELLED) throw new BadRequestException('Không thể hủy nhiều đơn cùng lúc. Hãy hủy từng đơn để kiểm tra hoàn tiền.');
    const uniqueIds = [...new Set(ids)];
    return this.prisma.$transaction(async (transaction) => {
      // Acquire locks in a stable order so simultaneous bulk actions do not lock the same orders
      // in opposite directions. This also keeps the paid-balance check consistent with payments.
      for (const orderId of [...uniqueIds].sort()) {
        await this.lockOrderForFinancialMutation(transaction, orderId);
      }
      const orders = await transaction.order.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, code: true, status: true, total: true, deposit: true, payments: { select: { amount: true, type: true } } } });
      if (orders.length !== uniqueIds.length) throw new NotFoundException('Có đơn hàng không còn tồn tại. Hãy tải lại danh sách.');
      const invalidOrder = orders.find((order) => !validStatusTransitions[order.status].includes(status));
      if (invalidOrder) throw new ConflictException(`Không thể chuyển đơn ${invalidOrder.code} sang trạng thái đã chọn.`);
      if (status === OrderStatus.DELIVERED) {
        const unpaidOrder = orders.find((order) => this.outstandingBalance(order) > 0);
        if (unpaidOrder) throw new ConflictException(`Đơn ${unpaidOrder.code} chưa thanh toán đủ, không thể chuyển sang trạng thái đã giao.`);
      }
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

  private aggregateItems(dto: Pick<CreateOrderDto, 'items'>): Map<string, number> {
    const quantities = new Map<string, number>();
    for (const item of dto.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.qty);
    return quantities;
  }

  private outstandingBalance(order: { total: number; deposit: number; payments: Array<{ amount: number; type: PaymentType }> }): number {
    return order.total - order.deposit - order.payments.reduce((sum, payment) => sum + (payment.type === PaymentType.PAYMENT ? payment.amount : -payment.amount), 0);
  }

  private getUpdateChanges(
    before: OrderAuditSnapshot,
    after: OrderAuditSnapshot,
  ): Prisma.InputJsonObject {
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const fields = [
      'customerId',
      'eyeExamId',
      'subtotal',
      'discount',
      'total',
      'dueDate',
      'warrantyUntil',
      'note',
    ] as const;

    for (const field of fields) {
      const previous = this.auditValue(before[field]);
      const next = this.auditValue(after[field]);
      if (JSON.stringify(previous) !== JSON.stringify(next)) {
        changes[field] = { from: previous, to: next };
      }
    }

    const previousItems = this.auditItems(before.items);
    const nextItems = this.auditItems(after.items);
    if (JSON.stringify(previousItems) !== JSON.stringify(nextItems)) {
      changes.items = { from: previousItems, to: nextItems };
    }
    return changes as Prisma.InputJsonObject;
  }

  private auditItems(items: OrderAuditSnapshot['items']) {
    return items
      .map((item) => ({
        productId: item.productId,
        name: item.name,
        unitPrice: item.unitPrice,
        qty: item.qty,
      }))
      .sort((left, right) => `${left.productId ?? ''}:${left.name}`.localeCompare(`${right.productId ?? ''}:${right.name}`));
  }

  private auditValue(value: unknown): string | number | boolean | null {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  private async lockOrderForFinancialMutation(
    transaction: Prisma.TransactionClient,
    orderId: string,
  ): Promise<void> {
    await transaction.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
  }

  private hashRequest(value: unknown): string {
    const normalize = (entry: unknown): unknown => {
      if (Array.isArray(entry)) return entry.map(normalize);
      if (entry && typeof entry === 'object') {
        return Object.fromEntries(
          Object.entries(entry)
            .filter(([, item]) => item !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, normalize(item)]),
        );
      }
      return entry;
    };
    return createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
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
