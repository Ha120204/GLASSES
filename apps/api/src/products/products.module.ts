import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductExcelService } from './product-excel.service';

@Module({ controllers: [ProductsController], providers: [ProductsService, ProductExcelService], exports: [ProductsService] })
export class ProductsModule {}
