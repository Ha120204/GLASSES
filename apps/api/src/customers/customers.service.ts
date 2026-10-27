import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Customer } from '@prisma/client';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { normalizePhone } from './phone.util';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: CustomerQueryDto,
  ): Promise<{ items: Customer[]; total: number; page: number; pageSize: number }> {
    const q = query.q?.trim();
    const normalizedPhone = q ? normalizePhone(q) : '';
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: normalizedPhone } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(id: string) {
    const [customer, ordersTotal] = await this.prisma.$transaction([
      this.prisma.customer.findFirst({
        where: { id, deletedAt: null },
        include: {
          eyeExams: { where: { archivedAt: null }, orderBy: { examDate: 'desc' } },
          orders: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
              payments: { select: { amount: true } },
              items: { select: { name: true, qty: true } },
            },
          },
        },
      }),
      this.prisma.order.count({ where: { customerId: id } }),
    ]);
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng.');
    return { ...customer, ordersTotal, latestEyeExam: customer.eyeExams[0] ?? null };
  }

  async findDeleted(
    query: CustomerQueryDto,
  ): Promise<{ items: Customer[]; total: number; page: number; pageSize: number }> {
    const q = query.q?.trim();
    const normalizedPhone = q ? normalizePhone(q) : '';
    const where: Prisma.CustomerWhereInput = {
      deletedAt: { not: null },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: normalizedPhone } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { deletedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async create(dto: CreateCustomerDto): Promise<Customer> {
    return this.persist(dto);
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    await this.getActiveCustomer(id);
    return this.persist(dto, id);
  }

  async remove(id: string): Promise<void> {
    await this.getActiveCustomer(id);
    await this.prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async removeMany(ids: string[]): Promise<{ count: number }> {
    const result = await this.prisma.customer.updateMany({
      where: { id: { in: [...new Set(ids)] }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { count: result.count };
  }

  async restore(id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng trong thùng rác.');
    return this.prisma.customer.update({ where: { id }, data: { deletedAt: null } });
  }

  async permanentlyRemove(id: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng trong thùng rác.');

    const [eyeExamCount, orderCount] = await this.prisma.$transaction([
      this.prisma.eyeExam.count({ where: { customerId: id } }),
      this.prisma.order.count({ where: { customerId: id } }),
    ]);
    if (eyeExamCount > 0 || orderCount > 0) {
      throw new ConflictException('Không thể xóa vĩnh viễn khách hàng đã có phiếu đo mắt hoặc đơn hàng.');
    }
    await this.prisma.customer.delete({ where: { id: customer.id } });
  }

  private async persist(dto: Partial<CreateCustomerDto>, id?: string): Promise<Customer> {
    const phone = dto.phone ? normalizePhone(dto.phone) : undefined;
    if (phone) {
      const exists = await this.prisma.customer.findFirst({
        where: { phone, NOT: id ? { id } : undefined },
      });
      if (exists) throw new ConflictException('Số điện thoại này đã được sử dụng.');
    }
    const data: Prisma.CustomerUncheckedCreateInput | Prisma.CustomerUncheckedUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(phone ? { phone } : {}),
      ...(dto.birthday !== undefined
        ? { birthday: dto.birthday ? new Date(dto.birthday) : null }
        : {}),
      ...(dto.gender !== undefined ? { gender: dto.gender || null } : {}),
      ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
      ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
    };
    return id
      ? this.prisma.customer.update({ where: { id }, data })
      : this.prisma.customer.create({ data: data as Prisma.CustomerUncheckedCreateInput });
  }

  private async getActiveCustomer(id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findFirst({ where: { id, deletedAt: null } });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng.');
    return customer;
  }
}
