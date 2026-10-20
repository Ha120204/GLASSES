import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { EyeExamsService } from '../eye-exams/eye-exams.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService, private readonly eyeExamsService: EyeExamsService) {}

  @Get()
  findAll(@Query() query: CustomerQueryDto) {
    return this.customersService.findAll(query);
  }

  @Get(':id/eye-exams')
  findEyeExams(@Param('id') id: string) { return this.eyeExamsService.findForCustomer(id); }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.customersService.remove(id);
  }
}
