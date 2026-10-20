import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { StockMovementQueryDto } from './dto/stock-movement-query.dto';
import { StockMovementHistoryQueryDto } from './dto/stock-movement-history-query.dto';
import { ProductsService } from './products.service';
import { StockMovementsService } from './stock-movements.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService, private readonly stockMovementsService: StockMovementsService) {}

  @Get()
  findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('trash')
  findDeleted(@Query() query: ProductQueryDto) {
    return this.productsService.findDeleted(query);
  }

  @Get('stock-movements')
  findAllStockMovements(@Query() query: StockMovementHistoryQueryDto) {
    return this.stockMovementsService.findAllHistory(query);
  }

  @Get(':id/stock-movements')
  findStockMovements(@Param('id') id: string, @Query() query: StockMovementQueryDto) {
    return this.stockMovementsService.findAll(id, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Post(':id/stock-movements')
  createStockMovement(@Param('id') id: string, @Body() dto: CreateStockMovementDto) {
    return this.stockMovementsService.create(id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.productsService.restore(id);
  }

  @Delete(':id/permanent')
  @HttpCode(204)
  async permanentlyRemove(@Param('id') id: string): Promise<void> {
    await this.productsService.permanentlyRemove(id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.productsService.remove(id);
  }
}
