import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { SkuSuggestionQueryDto } from './dto/sku-suggestion-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';
import { ProductExcelService, type ProductImportRow } from './product-excel.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService, private readonly productExcelService: ProductExcelService) {}

  @Get()
  findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('trash')
  findDeleted(@Query() query: ProductQueryDto) {
    return this.productsService.findDeleted(query);
  }

  @Get('next-sku')
  nextSku(@Query() query: SkuSuggestionQueryDto) {
    return this.productsService.getNextSku(query.type);
  }

  @Get('import-template')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="mau-nhap-san-pham.xlsx"')
  @Header('Cache-Control', 'no-store, max-age=0')
  async downloadImportTemplate() { return new StreamableFile(await this.productExcelService.createTemplate()); }

  @Get('export')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="danh-sach-san-pham.xlsx"')
  @Header('Cache-Control', 'no-store, max-age=0')
  async exportProducts(@Query() query: ProductQueryDto, @Query('ids') ids?: string) {
    return new StreamableFile(await this.productExcelService.exportActiveProducts({ ...query, ids: ids?.split(',').filter(Boolean) }));
  }

  @Post('import/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  previewImport(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Vui lòng chọn file Excel để nhập.');
    if (!file.originalname.toLocaleLowerCase().endsWith('.xlsx')) throw new BadRequestException('Chỉ hỗ trợ file Excel định dạng .xlsx.');
    return this.productExcelService.preview(file.buffer);
  }

  @Post('import')
  @HttpCode(200)
  importProducts(@Body('rows') rows: ProductImportRow[]) {
    if (!Array.isArray(rows) || !rows.length) throw new BadRequestException('Không có sản phẩm hợp lệ để nhập.');
    return this.productExcelService.importRows(rows);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
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
