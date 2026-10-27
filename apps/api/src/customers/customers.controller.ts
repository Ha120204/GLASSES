import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { EyeExamsService } from '../eye-exams/eye-exams.service';
import { CustomerExcelService, type CustomerImportRow } from './customer-excel.service';

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly eyeExamsService: EyeExamsService,
    private readonly customerExcelService: CustomerExcelService,
  ) {}

  @Get()
  findAll(@Query() query: CustomerQueryDto) {
    return this.customersService.findAll(query);
  }

  @Get('trash')
  findDeleted(@Query() query: CustomerQueryDto) {
    return this.customersService.findDeleted(query);
  }

  @Get('import-template')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="mau-nhap-khach-hang.xlsx"')
  @Header('Cache-Control', 'no-store, max-age=0')
  async downloadImportTemplate() {
    return new StreamableFile(await this.customerExcelService.createTemplate());
  }

  @Get('export')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="danh-sach-khach-hang.xlsx"')
  @Header('Cache-Control', 'no-store, max-age=0')
  async exportCustomers(@Query('ids') ids?: string) {
    const selectedIds = ids ? ids.split(',').filter(Boolean) : undefined;
    return new StreamableFile(await this.customerExcelService.exportActiveCustomers(selectedIds));
  }

  @Post('import/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  previewImport(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Vui lòng chọn file Excel để nhập.');
    if (!file.originalname.toLocaleLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Chỉ hỗ trợ file Excel định dạng .xlsx.');
    }
    return this.customerExcelService.preview(file.buffer);
  }

  @Post('import')
  @HttpCode(200)
  importCustomers(@Body('rows') rows: CustomerImportRow[]) {
    if (!Array.isArray(rows) || !rows.length) {
      throw new BadRequestException('Không có khách hàng hợp lệ để nhập.');
    }
    return this.customerExcelService.importRows(rows);
  }

  @Post('bulk-delete')
  bulkDelete(@Body('ids') ids: unknown) {
    return this.customersService.removeMany(this.requiredIds(ids));
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

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.customersService.restore(id);
  }

  @Delete(':id/permanent')
  @HttpCode(204)
  async permanentlyRemove(@Param('id') id: string): Promise<void> {
    await this.customersService.permanentlyRemove(id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.customersService.remove(id);
  }

  private requiredIds(value: unknown): string[] {
    if (!Array.isArray(value)) throw new BadRequestException('Danh sách khách hàng không hợp lệ.');
    const ids = [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))];
    if (!ids.length || ids.length > 100) throw new BadRequestException('Chỉ có thể xử lý từ 1 đến 100 khách hàng mỗi lần.');
    return ids;
  }
}
