import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-cookie.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { BulkUpdateOrderStatusDto } from './dto/bulk-update-order-status.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@Query() query: OrderQueryDto) {
    return this.ordersService.findAll(query);
  }

  @Get('status-counts')
  statusCounts() {
    return this.ordersService.statusCounts();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post(':id/payments')
  createPayment(@Param('id') id: string, @Body() dto: CreateOrderPaymentDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.createPayment(id, dto, request.user!.sub);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN)
  cancel(@Param('id') id: string, @Body() dto: CancelOrderDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.cancel(id, dto, request.user!.sub);
  }

  @Post()
  create(@Body() dto: CreateOrderDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.create(dto, request.user!.sub);
  }

  @Patch('bulk-status')
  bulkUpdateStatus(@Body() dto: BulkUpdateOrderStatusDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.bulkUpdateStatus(dto.ids, dto.status, request.user!.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.updateStatus(id, dto.status, request.user!.sub);
  }

}
