import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockMovementType, type Product, type StockMovement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { StockMovementQueryDto } from './dto/stock-movement-query.dto';
import { StockMovementHistoryQueryDto } from './dto/stock-movement-history-query.dto';

type StockMovementWithProduct = Prisma.StockMovementGetPayload<{
  include: { product: { select: { id: true; sku: true; name: true; deletedAt: true } } };
}>;

@Injectable()
export class StockMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(productId: string, query: StockMovementQueryDto): Promise<{ items: StockMovement[]; total: number; page: number; pageSize: number }> {
    await this.getActiveProduct(productId);
    const where = { productId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async findAllHistory(query: StockMovementHistoryQueryDto): Promise<{ items: StockMovementWithProduct[]; total: number; page: number; pageSize: number }> {
    if (query.dateFrom && query.dateTo && new Date(query.dateFrom) > new Date(query.dateTo)) {
      throw new BadRequestException('Ngày bắt đầu không được sau ngày kết thúc.');
    }

    const q = query.q?.trim();
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.dateFrom) createdAt.gte = new Date(`${query.dateFrom}T00:00:00.000+07:00`);
    if (query.dateTo) {
      const nextDay = new Date(`${query.dateTo}T00:00:00.000+07:00`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      createdAt.lt = nextDay;
    }
    const where: Prisma.StockMovementWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
      ...(q ? { product: { OR: [
        { sku: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
      ] } } : {}),
    };
    const include = { product: { select: { id: true, sku: true, name: true, deletedAt: true } } } as const;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async create(productId: string, dto: CreateStockMovementDto): Promise<{ product: Product; movement: StockMovement }> {
    const delta = this.resolveDelta(dto);
    return this.prisma.$transaction(async (transaction) => {
      await this.getActiveProduct(productId, transaction);
      let product: Product;
      if (delta < 0) {
        const updated = await transaction.product.updateMany({
          where: { id: productId, deletedAt: null, stockQty: { gte: -delta } },
          data: { stockQty: { increment: delta } },
        });
        if (!updated.count) throw new BadRequestException('Số lượng xuất/giảm vượt quá tồn kho hiện tại.');
        product = await transaction.product.findUniqueOrThrow({ where: { id: productId } });
      } else {
        product = await transaction.product.update({ where: { id: productId }, data: { stockQty: { increment: delta } } });
      }
      const movement = await transaction.stockMovement.create({
        data: { productId, type: dto.type, qty: delta, note: dto.note?.trim() || null },
      });
      return { product, movement };
    });
  }

  private resolveDelta(dto: CreateStockMovementDto): number {
    if (dto.type === StockMovementType.IN) return dto.qty;
    if (dto.type === StockMovementType.OUT) return -dto.qty;
    return dto.adjustmentDirection === 'OUT' ? -dto.qty : dto.qty;
  }

  private async getActiveProduct(productId: string, client: PrismaService | Prisma.TransactionClient = this.prisma): Promise<Product> {
    const product = await client.product.findFirst({ where: { id: productId, deletedAt: null } });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm.');
    return product;
  }
}
