import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderExcelService } from './order-excel.service';

@Module({ controllers: [OrdersController], providers: [OrdersService, OrderExcelService] })
export class OrdersModule {}
