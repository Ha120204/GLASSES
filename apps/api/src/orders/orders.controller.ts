import { Body, Controller, Get, Header, Param, Patch, Post, Query, Req, StreamableFile } from '@nestjs/common';
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
import { OrderExcelService } from './order-excel.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderExcelService: OrderExcelService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN)
  findAll(@Query() query: OrderQueryDto) {
    return this.ordersService.findAll(query);
  }

  @Get('status-counts')
  @Roles(UserRole.ADMIN)
  statusCounts(@Query() query: OrderQueryDto) {
    return this.ordersService.statusCounts(query.customerId);
  }

  @Get('export')
  @Roles(UserRole.ADMIN)
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="danh-sach-don-hang.xlsx"')
  @Header('Cache-Control', 'no-store, max-age=0')
  async exportOrders(@Query() query: OrderQueryDto, @Query('ids') ids?: string) {
    return new StreamableFile(await this.orderExcelService.export({
      ...query,
      ids: ids?.split(',').filter(Boolean),
    }));
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post(':id/payments')
  @Roles(UserRole.ADMIN)
  createPayment(@Param('id') id: string, @Body() dto: CreateOrderPaymentDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.createPayment(id, dto, request.user!.sub);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN)
  cancel(@Param('id') id: string, @Body() dto: CancelOrderDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.cancel(id, dto, request.user!.sub);
  }

  @Post(':id/archive')
  @Roles(UserRole.ADMIN)
  archive(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.ordersService.archive(id, request.user!.sub);
  }

  @Post(':id/restore')
  @Roles(UserRole.ADMIN)
  restore(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.ordersService.restore(id, request.user!.sub);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateOrderDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.create(dto, request.user!.sub);
  }

  @Patch('bulk-status')
  @Roles(UserRole.ADMIN)
  bulkUpdateStatus(@Body() dto: BulkUpdateOrderStatusDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.bulkUpdateStatus(dto.ids, dto.status, request.user!.sub);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.update(id, dto, request.user!.sub);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto, @Req() request: AuthenticatedRequest) {
    return this.ordersService.updateStatus(id, dto.status, request.user!.sub);
  }

}
