import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EyeExamAuditAction, Prisma, type EyeExam } from '@prisma/client';
import { CreateEyeExamDto } from './dto/create-eye-exam.dto';
import { EyeExamQueryDto } from './dto/eye-exam-query.dto';
import { UpdateEyeExamDto } from './dto/update-eye-exam.dto';
import { normalizePhone } from '../customers/phone.util';
import { PrismaService } from '../prisma/prisma.service';

const eyeExamInclude = { customer: { select: { id: true, name: true, phone: true } } } as const;
const auditFields = ['customerId', 'examDate', 'examiner', 'rSph', 'rCyl', 'rAxis', 'rAdd', 'rPd', 'pdTotal', 'rPrism', 'rBase', 'rSegHeight', 'lSph', 'lCyl', 'lAxis', 'lAdd', 'lPd', 'lPrism', 'lBase', 'lSegHeight', 'wearingPurpose', 'lensDesign', 'noPrescription', 'noPrescriptionReason', 'note'] as const;
type EyeExamWithCustomer = Prisma.EyeExamGetPayload<{ include: typeof eyeExamInclude }>;

@Injectable()
export class EyeExamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEyeExamDto, createdById: string) {
    await this.ensureCustomer(dto.customerId);
    this.validateExamDate(dto.examDate);
    const exam = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.eyeExam.create({ data: this.toData(dto), include: eyeExamInclude });
      await transaction.eyeExamAuditLog.create({ data: { eyeExamId: created.id, action: EyeExamAuditAction.CREATED, createdById } });
      return created;
    });
    return this.serialize(exam);
  }

  async createAndLock(dto: CreateEyeExamDto, createdById: string) {
    await this.ensureCustomer(dto.customerId);
    this.validateExamDate(dto.examDate);
    this.validateFinalPrescription(dto as unknown as Record<string, unknown>);
    const exam = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.eyeExam.create({ data: { ...this.toData(dto), lockedAt: new Date(), lockedById: createdById }, include: eyeExamInclude });
      await transaction.eyeExamAuditLog.createMany({ data: [
        { eyeExamId: created.id, action: EyeExamAuditAction.CREATED, createdById },
        { eyeExamId: created.id, action: EyeExamAuditAction.LOCKED, createdById },
      ] });
      return created;
    });
    return this.serialize(exam);
  }

  async findAll(query: EyeExamQueryDto) {
    this.validateDateRange(query);
    const q = query.q?.trim();
    const where: Prisma.EyeExamWhereInput = {
      archivedAt: null,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.dateFrom || query.dateTo ? { examDate: { ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}), ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}) } } : {}),
      ...(query.status === 'LOCKED' ? { lockedAt: { not: null } } : query.status === 'DRAFT' ? { lockedAt: null } : {}),
      customer: { deletedAt: null, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: normalizePhone(q) } }] } : {}) },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.eyeExam.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { examDate: 'desc' }, include: eyeExamInclude }),
      this.prisma.eyeExam.count({ where }),
    ]);
    return { items: items.map((item) => this.serialize(item)), total, page: query.page, pageSize: query.pageSize };
  }

  async findArchived(query: EyeExamQueryDto) {
    this.validateDateRange(query);
    const q = query.q?.trim();
    const where: Prisma.EyeExamWhereInput = {
      archivedAt: { not: null },
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.dateFrom || query.dateTo ? { examDate: { ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}), ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}) } } : {}),
      ...(query.status === 'LOCKED' ? { lockedAt: { not: null } } : query.status === 'DRAFT' ? { lockedAt: null } : {}),
      customer: { deletedAt: null, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: normalizePhone(q) } }] } : {}) },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.eyeExam.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { archivedAt: 'desc' }, include: eyeExamInclude }),
      this.prisma.eyeExam.count({ where }),
    ]);
    return { items: items.map((item) => this.serialize(item)), total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(id: string) {
    const exam = await this.prisma.eyeExam.findFirst({ where: { id, archivedAt: null, customer: { deletedAt: null } }, include: { customer: { select: { id: true, name: true, phone: true, birthday: true, address: true } } } });
    if (!exam) throw new NotFoundException('Không tìm thấy phiếu đo mắt.');
    const setting = await this.prisma.setting.findFirst({ select: { storeName: true, address: true, phone: true, invoiceTemplate: true } });
    return { ...this.serialize(exam), setting };
  }

  async findForCustomer(customerId: string) {
    await this.ensureCustomer(customerId);
    const items = await this.prisma.eyeExam.findMany({ where: { customerId, archivedAt: null }, orderBy: { examDate: 'desc' } });
    return items.map((item) => this.serialize(item));
  }

  async findHistory(id: string) {
    await this.getExam(id, true);
    return this.prisma.eyeExamAuditLog.findMany({
      where: { eyeExamId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, action: true, changes: true, createdAt: true, createdBy: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdateEyeExamDto, updatedById: string) {
    const existing = await this.getExam(id);
    if (existing.lockedAt) throw new ConflictException('Phiếu đo đã chốt, không thể chỉnh sửa. Quản trị viên cần mở chốt trước.');
    if (dto.customerId && dto.customerId !== existing.customerId) await this.ensureCustomer(dto.customerId);
    this.validateExamDate(dto.examDate ?? existing.examDate.toISOString());
    const exam = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.eyeExam.update({ where: { id }, data: this.toData(dto), include: eyeExamInclude });
      const changes = this.getChanges(existing, updated);
      if (Object.keys(changes).length) await transaction.eyeExamAuditLog.create({ data: { eyeExamId: id, action: EyeExamAuditAction.UPDATED, changes, createdById: updatedById } });
      return updated;
    });
    return this.serialize(exam);
  }

  async updateAndLock(id: string, dto: UpdateEyeExamDto, lockedById: string) {
    const existing = await this.getExam(id);
    if (existing.lockedAt) throw new ConflictException('Phiếu đo này đã được chốt.');
    if (dto.customerId && dto.customerId !== existing.customerId) await this.ensureCustomer(dto.customerId);
    this.validateExamDate(dto.examDate ?? existing.examDate.toISOString());
    this.validateFinalPrescription({ ...existing, ...dto } as Record<string, unknown>);
    const exam = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.eyeExam.update({ where: { id }, data: { ...this.toData(dto), lockedAt: new Date(), lockedById }, include: eyeExamInclude });
      const changes = this.getChanges(existing, updated);
      if (Object.keys(changes).length) await transaction.eyeExamAuditLog.create({ data: { eyeExamId: id, action: EyeExamAuditAction.UPDATED, changes, createdById: lockedById } });
      await transaction.eyeExamAuditLog.create({ data: { eyeExamId: id, action: EyeExamAuditAction.LOCKED, createdById: lockedById } });
      return updated;
    });
    return this.serialize(exam);
  }

  async lock(id: string, lockedById: string) {
    const existing = await this.getExam(id);
    if (existing.lockedAt) throw new ConflictException('Phiếu đo này đã được chốt.');
    this.validateFinalPrescription(existing as unknown as Record<string, unknown>);
    return this.prisma.$transaction(async (transaction) => {
      const exam = await transaction.eyeExam.update({ where: { id }, data: { lockedAt: new Date(), lockedById }, include: eyeExamInclude });
      await transaction.eyeExamAuditLog.create({ data: { eyeExamId: id, action: EyeExamAuditAction.LOCKED, createdById: lockedById } });
      return this.serialize(exam);
    });
  }

  async unlock(id: string, unlockedById: string) {
    const existing = await this.getExam(id);
    if (!existing.lockedAt) throw new ConflictException('Phiếu đo này chưa được chốt.');
    return this.prisma.$transaction(async (transaction) => {
      const exam = await transaction.eyeExam.update({ where: { id }, data: { lockedAt: null, lockedById: null }, include: eyeExamInclude });
      await transaction.eyeExamAuditLog.create({ data: { eyeExamId: id, action: EyeExamAuditAction.UNLOCKED, createdById: unlockedById } });
      return this.serialize(exam);
    });
  }

  async archive(id: string, archivedById: string): Promise<void> {
    await this.getExam(id);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.eyeExam.update({ where: { id }, data: { archivedAt: new Date(), archivedById } });
      await transaction.eyeExamAuditLog.create({ data: { eyeExamId: id, action: EyeExamAuditAction.ARCHIVED, createdById: archivedById } });
    });
  }

  async archiveMany(ids: string[], archivedById: string): Promise<{ count: number }> {
    const exams = await this.prisma.eyeExam.findMany({
      where: { id: { in: [...new Set(ids)] }, archivedAt: null, customer: { deletedAt: null } },
      select: { id: true },
    });
    if (!exams.length) return { count: 0 };
    await this.prisma.$transaction(async (transaction) => {
      await transaction.eyeExam.updateMany({
        where: { id: { in: exams.map((exam) => exam.id) } },
        data: { archivedAt: new Date(), archivedById },
      });
      await transaction.eyeExamAuditLog.createMany({
        data: exams.map((exam) => ({ eyeExamId: exam.id, action: EyeExamAuditAction.ARCHIVED, createdById: archivedById })),
      });
    });
    return { count: exams.length };
  }

  async restore(id: string, restoredById: string) {
    const existing = await this.prisma.eyeExam.findFirst({ where: { id, archivedAt: { not: null }, customer: { deletedAt: null } } });
    if (!existing) throw new NotFoundException('Không tìm thấy phiếu đo đã lưu trữ.');
    return this.prisma.$transaction(async (transaction) => {
      const exam = await transaction.eyeExam.update({ where: { id }, data: { archivedAt: null, archivedById: null }, include: eyeExamInclude });
      await transaction.eyeExamAuditLog.create({ data: { eyeExamId: id, action: EyeExamAuditAction.RESTORED, createdById: restoredById } });
      return this.serialize(exam);
    });
  }

  private async ensureCustomer(id: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({ where: { id, deletedAt: null } });
    if (!customer) throw new NotFoundException('Khách hàng không tồn tại hoặc đã bị xóa.');
  }

  private async getExam(id: string, includeArchived = false): Promise<EyeExam> {
    const exam = await this.prisma.eyeExam.findFirst({ where: { id, ...(includeArchived ? {} : { archivedAt: null }), customer: { deletedAt: null } } });
    if (!exam) throw new NotFoundException('Không tìm thấy phiếu đo mắt.');
    return exam;
  }

  private validateCylinderAxis(values: { rCyl?: unknown; rAxis?: unknown; lCyl?: unknown; lAxis?: unknown }): void {
    this.validateEyeCylinderAxis('Mắt phải', values.rCyl, values.rAxis);
    this.validateEyeCylinderAxis('Mắt trái', values.lCyl, values.lAxis);
  }

  private validateEyeCylinderAxis(eye: string, cylinder: unknown, axis: unknown): void {
    const hasCylinder = cylinder !== undefined && cylinder !== null && Number(cylinder) !== 0;
    const hasAxis = axis !== undefined && axis !== null;
    if (hasCylinder && !hasAxis) throw new BadRequestException(`${eye} có CYL thì bắt buộc nhập AXIS.`);
    if (!hasCylinder && hasAxis) throw new BadRequestException(`${eye} chỉ được nhập AXIS khi có CYL khác 0.`);
  }

  private validatePrismBase(values: { rPrism?: unknown; rBase?: unknown; lPrism?: unknown; lBase?: unknown }): void {
    this.validateEyePrismBase('Mắt phải', values.rPrism, values.rBase);
    this.validateEyePrismBase('Mắt trái', values.lPrism, values.lBase);
  }

  private validateFinalPrescription(values: Record<string, unknown>): void {
    this.validateCylinderAxis(values);
    this.validatePrismBase(values);
    const hasTotalPd = values.pdTotal !== undefined && values.pdTotal !== null;
    const hasRightPd = values.rPd !== undefined && values.rPd !== null;
    const hasLeftPd = values.lPd !== undefined && values.lPd !== null;
    if (hasTotalPd && (hasRightPd || hasLeftPd)) throw new BadRequestException('Chỉ nhập PD tổng hoặc PD đơn mắt, không nhập đồng thời.');
    if (!hasTotalPd && hasRightPd !== hasLeftPd) throw new BadRequestException('PD đơn mắt cần có đủ giá trị mắt phải và mắt trái.');
    const correctionFields = ['rSph', 'rCyl', 'rAxis', 'rAdd', 'rPd', 'pdTotal', 'rPrism', 'rBase', 'rSegHeight', 'lSph', 'lCyl', 'lAxis', 'lAdd', 'lPd', 'lPrism', 'lBase', 'lSegHeight'] as const;
    const hasCorrection = correctionFields.some((field) => values[field] !== undefined && values[field] !== null);
    if (values.noPrescription) {
      if (hasCorrection) throw new BadRequestException('Phiếu không kê đơn không thể có thông số khúc xạ.');
      if (typeof values.noPrescriptionReason !== 'string' || !values.noPrescriptionReason.trim()) throw new BadRequestException('Vui lòng nêu lý do khi chọn không kê đơn.');
    } else {
      if (!hasCorrection) throw new BadRequestException('Nhập thông số khúc xạ hoặc chọn không kê đơn.');
      if (values.rSph === undefined || values.rSph === null || values.lSph === undefined || values.lSph === null) throw new BadRequestException('Chốt phiếu cần có SPH cho cả mắt phải và mắt trái.');
      if (!hasTotalPd && !(hasRightPd && hasLeftPd)) throw new BadRequestException('Chốt phiếu cần có PD tổng hoặc PD đơn mắt cho cả hai mắt.');
    }
  }

  private validateExamDate(value: string): void {
    const examDate = new Date(value);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (examDate > endOfToday) throw new BadRequestException('Ngày đo không thể ở tương lai.');
  }

  private validateDateRange(query: EyeExamQueryDto): void {
    if (query.dateFrom && query.dateTo && new Date(query.dateFrom) > new Date(query.dateTo)) {
      throw new BadRequestException('Từ ngày phải trước hoặc bằng đến ngày.');
    }
  }

  private validateEyePrismBase(eye: string, prism: unknown, base: unknown): void {
    const hasPrism = prism !== undefined && prism !== null && Number(prism) !== 0;
    const hasBase = base !== undefined && base !== null && String(base).trim() !== '';
    if (hasPrism && !hasBase) throw new BadRequestException(`${eye} có PRISM thì bắt buộc chọn BASE.`);
    if (!hasPrism && hasBase) throw new BadRequestException(`${eye} chỉ được chọn BASE khi có PRISM khác 0.`);
  }

  private getChanges(before: EyeExam, after: EyeExam): Prisma.InputJsonObject {
    const changes: Record<string, { from: string | number | boolean | null; to: string | number | boolean | null }> = {};
    for (const field of auditFields) {
      const previous = this.auditValue(before[field]);
      const next = this.auditValue(after[field]);
      if (JSON.stringify(previous) !== JSON.stringify(next)) changes[field] = { from: previous, to: next };
    }
    return changes as Prisma.InputJsonObject;
  }

  private auditValue(value: unknown): string | number | boolean | null {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    if (value instanceof Prisma.Decimal) return value.toNumber();
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  private toData(dto: Partial<CreateEyeExamDto>): Prisma.EyeExamUncheckedCreateInput { const keys = ['customerId', 'examDate', 'examiner', 'rSph', 'rCyl', 'rAxis', 'rAdd', 'rPd', 'pdTotal', 'rPrism', 'rBase', 'rSegHeight', 'lSph', 'lCyl', 'lAxis', 'lAdd', 'lPd', 'lPrism', 'lBase', 'lSegHeight', 'wearingPurpose', 'lensDesign', 'noPrescription', 'noPrescriptionReason', 'note'] as const; return keys.reduce<Prisma.EyeExamUncheckedCreateInput>((data, key) => { const value = dto[key]; if (value !== undefined) { (data as Record<string, unknown>)[key] = key === 'examDate' ? new Date(value as string) : (typeof value === 'string' ? value.trim() || null : value); } return data; }, {} as Prisma.EyeExamUncheckedCreateInput); }
  private serialize(exam: EyeExamWithCustomer | EyeExam) { const output = { ...exam } as Record<string, unknown>; for (const key of ['rSph', 'rCyl', 'rAdd', 'rPd', 'pdTotal', 'rPrism', 'rSegHeight', 'lSph', 'lCyl', 'lAdd', 'lPd', 'lPrism', 'lSegHeight']) { const value = output[key]; output[key] = value instanceof Prisma.Decimal ? value.toNumber() : value; } return output; }
}
