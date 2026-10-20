import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type EyeExam } from '@prisma/client';
import { CreateEyeExamDto } from './dto/create-eye-exam.dto';
import { EyeExamQueryDto } from './dto/eye-exam-query.dto';
import { UpdateEyeExamDto } from './dto/update-eye-exam.dto';
import { normalizePhone } from '../customers/phone.util';
import { PrismaService } from '../prisma/prisma.service';

type EyeExamWithCustomer = EyeExam & { customer: { id: string; name: string; phone: string } };

@Injectable()
export class EyeExamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEyeExamDto) {
    await this.ensureCustomer(dto.customerId);
    this.validateCylinderAxis(dto);
    const nextReminderDate = await this.resolveReminder(dto.examDate, dto.nextReminderDate);
    const exam = await this.prisma.eyeExam.create({ data: { ...this.toData(dto), nextReminderDate } as Prisma.EyeExamUncheckedCreateInput, include: { customer: { select: { id: true, name: true, phone: true } } } });
    return this.serialize(exam);
  }

  async findAll(query: EyeExamQueryDto) {
    const q = query.q?.trim();
    const where: Prisma.EyeExamWhereInput = {
      ...(query.customerId ? { customerId: query.customerId } : {}),
      customer: { deletedAt: null, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: normalizePhone(q) } }] } : {}) },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.eyeExam.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { examDate: 'desc' }, include: { customer: { select: { id: true, name: true, phone: true } } } }),
      this.prisma.eyeExam.count({ where }),
    ]);
    return { items: items.map((item) => this.serialize(item)), total, page: query.page, pageSize: query.pageSize };
  }

  async getConfig(): Promise<{ reminderMonths: number }> {
    const setting = await this.prisma.setting.findFirst({ select: { reminderMonths: true } });
    return { reminderMonths: setting?.reminderMonths ?? 12 };
  }

  async findOne(id: string) {
    const exam = await this.prisma.eyeExam.findFirst({ where: { id, customer: { deletedAt: null } }, include: { customer: { select: { id: true, name: true, phone: true, birthday: true, address: true } } } });
    if (!exam) throw new NotFoundException('Không tìm thấy phiếu đo mắt.');
    const setting = await this.prisma.setting.findFirst({ select: { storeName: true, address: true, phone: true } });
    return { ...this.serialize(exam), setting };
  }

  async findForCustomer(customerId: string) {
    await this.ensureCustomer(customerId);
    const items = await this.prisma.eyeExam.findMany({ where: { customerId }, orderBy: { examDate: 'desc' } });
    return items.map((item) => this.serialize(item));
  }

  async update(id: string, dto: UpdateEyeExamDto) {
    const existing = await this.getExam(id);
    if (dto.customerId && dto.customerId !== existing.customerId) await this.ensureCustomer(dto.customerId);
    this.validateCylinderAxis({ rCyl: dto.rCyl ?? existing.rCyl, rAxis: dto.rAxis ?? existing.rAxis, lCyl: dto.lCyl ?? existing.lCyl, lAxis: dto.lAxis ?? existing.lAxis });
    const examDate = dto.examDate ?? existing.examDate.toISOString().slice(0, 10);
    const nextReminderDate = await this.resolveReminder(examDate, dto.nextReminderDate);
    const exam = await this.prisma.eyeExam.update({ where: { id }, data: { ...this.toData(dto), nextReminderDate } as Prisma.EyeExamUncheckedUpdateInput, include: { customer: { select: { id: true, name: true, phone: true } } } });
    return this.serialize(exam);
  }

  async remove(id: string): Promise<void> { await this.getExam(id); await this.prisma.eyeExam.delete({ where: { id } }); }

  private async ensureCustomer(id: string): Promise<void> { const customer = await this.prisma.customer.findFirst({ where: { id, deletedAt: null } }); if (!customer) throw new NotFoundException('Khách hàng không tồn tại hoặc đã bị xóa.'); }
  private async getExam(id: string): Promise<EyeExam> { const exam = await this.prisma.eyeExam.findFirst({ where: { id, customer: { deletedAt: null } } }); if (!exam) throw new NotFoundException('Không tìm thấy phiếu đo mắt.'); return exam; }
  private validateCylinderAxis(values: { rCyl?: unknown; rAxis?: unknown; lCyl?: unknown; lAxis?: unknown }): void { if (values.rCyl !== undefined && values.rCyl !== null && Number(values.rCyl) !== 0 && (values.rAxis === undefined || values.rAxis === null)) throw new BadRequestException('Mắt phải có CYL thì bắt buộc nhập AXIS.'); if (values.lCyl !== undefined && values.lCyl !== null && Number(values.lCyl) !== 0 && (values.lAxis === undefined || values.lAxis === null)) throw new BadRequestException('Mắt trái có CYL thì bắt buộc nhập AXIS.'); }
  private async resolveReminder(examDate: string, override?: string | null): Promise<Date> { if (override) return new Date(override); const setting = await this.prisma.setting.findFirst({ select: { reminderMonths: true } }); const date = new Date(examDate); date.setMonth(date.getMonth() + (setting?.reminderMonths ?? 12)); return date; }
  private toData(dto: Partial<CreateEyeExamDto>): Prisma.EyeExamUncheckedCreateInput { const keys = ['customerId','examDate','examiner','rSph','rCyl','rAxis','rAdd','rPd','lSph','lCyl','lAxis','lAdd','lPd','note'] as const; return keys.reduce<Prisma.EyeExamUncheckedCreateInput>((data, key) => { const value = dto[key]; if (value !== undefined) { (data as Record<string, unknown>)[key] = key === 'examDate' ? new Date(value as string) : (typeof value === 'string' ? value.trim() || null : value); } return data; }, {} as Prisma.EyeExamUncheckedCreateInput); }
  private serialize(exam: EyeExamWithCustomer | EyeExam) { const output = { ...exam } as Record<string, unknown>; for (const key of ['rSph','rCyl','rAdd','rPd','lSph','lCyl','lAdd','lPd']) { const value = output[key]; output[key] = value instanceof Prisma.Decimal ? value.toNumber() : value; } return output; }
}
