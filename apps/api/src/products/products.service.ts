import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ProductQueryDto): Promise<{ items: Product[]; total: number; page: number; pageSize: number }> {
    const q = query.q?.trim();
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(q ? { OR: [
        { sku: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(id: string): Promise<Product> {
    return this.getActiveProduct(id);
  }

  async findDeleted(query: ProductQueryDto): Promise<{ items: Product[]; total: number; page: number; pageSize: number }> {
    const q = query.q?.trim();
    const where: Prisma.ProductWhereInput = {
      deletedAt: { not: null },
      ...(q ? { OR: [
        { sku: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { deletedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async create(dto: CreateProductDto): Promise<Product> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const data = this.createData(dto);
        const product = await transaction.product.create({ data });
        if (product.stockQty > 0) {
          await transaction.stockMovement.create({
            data: { productId: product.id, type: 'IN', qty: product.stockQty, note: 'Tồn đầu kỳ' },
          });
        }
        return product;
      });
    } catch (error: unknown) {
      this.throwUniqueSku(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    await this.getActiveProduct(id);
    try {
      return await this.prisma.product.update({ where: { id }, data: this.updateData(dto) });
    } catch (error: unknown) {
      this.throwUniqueSku(error);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.getActiveProduct(id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm trong thùng rác.');
    try {
      return await this.prisma.product.update({ where: { id }, data: { deletedAt: null } });
    } catch (error: unknown) {
      this.throwUniqueSku(error);
      throw error;
    }
  }

  async permanentlyRemove(id: string): Promise<void> {
    const product = await this.prisma.product.findFirst({ where: { id, deletedAt: { not: null } } });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm trong thùng rác.');

    const [stockMovementCount, orderItemCount] = await this.prisma.$transaction([
      this.prisma.stockMovement.count({ where: { productId: id } }),
      this.prisma.orderItem.count({ where: { productId: id } }),
    ]);
    if (stockMovementCount > 0 || orderItemCount > 0) {
      throw new ConflictException('Không thể xóa vĩnh viễn sản phẩm đã có lịch sử kho hoặc đơn hàng.');
    }
    await this.prisma.product.delete({ where: { id: product.id } });
  }

  private createData(dto: CreateProductDto): Prisma.ProductUncheckedCreateInput {
    return {
      sku: dto.sku.trim().toUpperCase(),
      barcode: dto.barcode?.trim() || null,
      name: dto.name.trim(),
      type: dto.type,
      brand: dto.brand?.trim() || null,
      costPrice: dto.costPrice,
      salePrice: dto.salePrice,
      stockQty: dto.stockQty ?? 0,
      minStock: dto.minStock ?? 0,
      supplier: dto.supplier?.trim() || null,
      active: dto.active ?? true,
    };
  }

  private updateData(dto: UpdateProductDto): Prisma.ProductUncheckedUpdateInput {
    return {
      ...(dto.sku !== undefined ? { sku: dto.sku.trim().toUpperCase() } : {}),
      ...(dto.barcode !== undefined ? { barcode: dto.barcode?.trim() || null } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.brand !== undefined ? { brand: dto.brand?.trim() || null } : {}),
      ...(dto.costPrice !== undefined ? { costPrice: dto.costPrice } : {}),
      ...(dto.salePrice !== undefined ? { salePrice: dto.salePrice } : {}),
      ...(dto.minStock !== undefined ? { minStock: dto.minStock } : {}),
      ...(dto.supplier !== undefined ? { supplier: dto.supplier?.trim() || null } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    };
  }

  private async getActiveProduct(id: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm.');
    return product;
  }

  private throwUniqueSku(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Mã sản phẩm đã được sử dụng.');
    }
  }

}
