import { createHash } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { prepareProductImage } from './product-image';

const SKU_PREFIX_BY_TYPE = {
  FRAME: 'GONG',
  LENS: 'TRONG',
  CONTACT: 'CONTACT',
  ACCESSORY: 'PK',
} as const;

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
        orderBy: [{ [query.sortBy ?? 'name']: query.sortDirection ?? 'asc' }, { id: 'asc' }],
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

  async getImage(id: string, variant: 'full' | 'thumbnail' = 'full'): Promise<{ content: Uint8Array; mimeType: string }> {
    const image = await this.prisma.productImage.findFirst({
      where: { productId: id },
      select: { content: true, thumbnail: true, mimeType: true },
    });
    if (!image) throw new NotFoundException('Không tìm thấy ảnh sản phẩm.');
    return { content: variant === 'thumbnail' ? (image.thumbnail ?? image.content) : image.content, mimeType: image.mimeType };
  }

  async saveImage(id: string, file?: Express.Multer.File): Promise<Product> {
    await this.getActiveProduct(id);
    const { content, thumbnail, mimeType } = await prepareProductImage(file);
    const [, product] = await this.prisma.$transaction([
      this.prisma.productImage.upsert({
        where: { productId: id },
        create: { productId: id, content, thumbnail, mimeType },
        update: { content, thumbnail, mimeType },
      }),
      this.prisma.product.update({ where: { id }, data: { imageUpdatedAt: new Date() } }),
    ]);
    return product;
  }

  async removeImage(id: string): Promise<Product> {
    await this.getActiveProduct(id);
    const [, product] = await this.prisma.$transaction([
      this.prisma.productImage.deleteMany({ where: { productId: id } }),
      this.prisma.product.update({ where: { id }, data: { imageUpdatedAt: null } }),
    ]);
    return product;
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
    const requestHash = dto.idempotencyKey ? this.hashCreateRequest(dto) : undefined;
    if (dto.idempotencyKey) {
      const previous = await this.findIdempotentProduct(dto.idempotencyKey, requestHash!);
      if (previous) return previous;
    }
    if (dto.autoSku) return this.createWithAutoSku(dto, requestHash);
    try {
      return await this.prisma.product.create({ data: this.createData(dto, undefined, requestHash) });
    } catch (error: unknown) {
      const duplicate = await this.findDuplicateRequestAfterConflict(error, dto, requestHash);
      if (duplicate) return duplicate;
      this.throwUniqueSku(error);
      throw error;
    }
  }

  async getNextSku(type: Product['type']): Promise<{ sku: string }> {
    const prefix = SKU_PREFIX_BY_TYPE[type];
    const products = await this.prisma.product.findMany({
      where: { sku: { startsWith: prefix, mode: 'insensitive' } },
      select: { sku: true },
    });
    const skuPattern = new RegExp(`^${prefix}[-_](\\d+)$`, 'i');
    const highestSequence = products.reduce((highest, product) => {
      const sequence = skuPattern.exec(product.sku)?.[1];
      return sequence ? Math.max(highest, Number(sequence)) : highest;
    }, 0);
    return { sku: `${prefix}-${String(highestSequence + 1).padStart(3, '0')}` };
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

    const orderItemCount = await this.prisma.orderItem.count({ where: { productId: id } });
    if (orderItemCount > 0) {
      throw new ConflictException('Không thể xóa vĩnh viễn sản phẩm đã xuất hiện trong đơn hàng.');
    }
    await this.prisma.product.delete({ where: { id: product.id } });
  }

  private async createWithAutoSku(dto: CreateProductDto, requestHash?: string): Promise<Product> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { sku } = await this.getNextSku(dto.type);
      try {
        return await this.prisma.product.create({ data: this.createData(dto, sku, requestHash) });
      } catch (error: unknown) {
        const duplicate = await this.findDuplicateRequestAfterConflict(error, dto, requestHash);
        if (duplicate) return duplicate;
        if (this.isUniqueSkuError(error)) continue;
        this.throwUniqueSku(error);
        throw error;
      }
    }
    throw new ConflictException('Không thể cấp mã sản phẩm tự động. Vui lòng thử lại.');
  }

  private createData(dto: CreateProductDto, generatedSku?: string, requestHash?: string): Prisma.ProductUncheckedCreateInput {
    return {
      sku: (generatedSku ?? dto.sku).trim().toUpperCase(),
      idempotencyKey: dto.idempotencyKey ?? null,
      requestHash: requestHash ?? null,
      barcode: this.normalizeBarcode(dto.barcode),
      name: dto.name.trim(),
      type: dto.type,
      brand: dto.brand?.trim() || null,
      costPrice: dto.costPrice,
      salePrice: dto.salePrice,
      supplier: dto.supplier?.trim() || null,
      active: dto.active ?? true,
    };
  }

  private hashCreateRequest(dto: CreateProductDto): string {
    const payload = {
      sku: dto.autoSku ? null : dto.sku.trim().toUpperCase(),
      autoSku: dto.autoSku === true,
      barcode: this.normalizeBarcode(dto.barcode),
      name: dto.name.trim(),
      type: dto.type,
      brand: dto.brand?.trim() || null,
      costPrice: dto.costPrice,
      salePrice: dto.salePrice,
      supplier: dto.supplier?.trim() || null,
      active: dto.active ?? true,
    };
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private async findIdempotentProduct(key: string, hash: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({ where: { idempotencyKey: key } });
    if (product && product.requestHash !== hash) throw new ConflictException('Mã yêu cầu đã được dùng cho nội dung khác.');
    return product;
  }

  private async findDuplicateRequestAfterConflict(error: unknown, dto: CreateProductDto, requestHash?: string): Promise<Product | null> {
    if (!dto.idempotencyKey || !requestHash || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return null;
    return this.findIdempotentProduct(dto.idempotencyKey, requestHash);
  }

  private updateData(dto: UpdateProductDto): Prisma.ProductUncheckedUpdateInput {
    return {
      ...(dto.sku !== undefined ? { sku: dto.sku.trim().toUpperCase() } : {}),
      ...(dto.barcode !== undefined ? { barcode: this.normalizeBarcode(dto.barcode) } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.brand !== undefined ? { brand: dto.brand?.trim() || null } : {}),
      ...(dto.costPrice !== undefined ? { costPrice: dto.costPrice } : {}),
      ...(dto.salePrice !== undefined ? { salePrice: dto.salePrice } : {}),
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
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target.join(',') : String(target ?? '');
      throw new ConflictException(fields.includes('barcode') ? 'Mã vạch đã được sử dụng.' : 'Mã sản phẩm đã được sử dụng.');
    }
  }

  private isUniqueSkuError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
    const target = error.meta?.target;
    const fields = Array.isArray(target) ? target : [String(target ?? '')];
    return fields.some((field) => field.includes('sku'));
  }

  private normalizeBarcode(value: string | null | undefined): string | null {
    const barcode = value?.trim().toUpperCase();
    return barcode || null;
  }

}
