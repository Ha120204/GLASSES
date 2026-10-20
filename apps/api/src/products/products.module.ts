import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { StockMovementsService } from './stock-movements.service';

@Module({ controllers: [ProductsController], providers: [ProductsService, StockMovementsService], exports: [ProductsService] })
export class ProductsModule {}
