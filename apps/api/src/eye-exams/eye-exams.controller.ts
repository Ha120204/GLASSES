import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Query, Req, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedRequest } from '../auth/jwt-cookie.guard';
import { CreateEyeExamDto } from './dto/create-eye-exam.dto';
import { EyeExamQueryDto } from './dto/eye-exam-query.dto';
import { UpdateEyeExamDto } from './dto/update-eye-exam.dto';
import { EyeExamsService } from './eye-exams.service';
import { EyeExamExcelService, type EyeExamImportRow } from './eye-exam-excel.service';

@Controller('eye-exams')
export class EyeExamsController {
  constructor(private readonly eyeExamsService: EyeExamsService, private readonly eyeExamExcelService: EyeExamExcelService) {}
  @Post() create(@Body() dto: CreateEyeExamDto, @Req() request: AuthenticatedRequest) { return this.eyeExamsService.create(dto, request.user!.sub); }
  @Post('finalize') createAndLock(@Body() dto: CreateEyeExamDto, @Req() request: AuthenticatedRequest) { return this.eyeExamsService.createAndLock(dto, request.user!.sub); }
  @Get() findAll(@Query() query: EyeExamQueryDto) { return this.eyeExamsService.findAll(query); }
  @Get('archive') findArchived(@Query() query: EyeExamQueryDto) { return this.eyeExamsService.findArchived(query); }
  @Get('import-template')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="mau-nhap-phieu-do-mat.xlsx"')
  @Header('Cache-Control', 'no-store, max-age=0')
  async downloadImportTemplate() { return new StreamableFile(await this.eyeExamExcelService.createTemplate()); }
  @Get('export')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="phieu-do-mat.xlsx"')
  @Header('Cache-Control', 'no-store, max-age=0')
  async export(@Query() query: EyeExamQueryDto, @Query('ids') ids: string | undefined) { return new StreamableFile(await this.eyeExamExcelService.export({ ...query, ids: ids?.split(',').filter(Boolean) })); }
  @Post('import/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  previewImport(@UploadedFile() file?: Express.Multer.File) { if (!file?.buffer?.length) throw new BadRequestException('Vui lòng chọn file Excel để nhập.'); if (!file.originalname.toLocaleLowerCase().endsWith('.xlsx')) throw new BadRequestException('Chỉ hỗ trợ file Excel định dạng .xlsx.'); return this.eyeExamExcelService.preview(file.buffer); }
  @Post('import')
  @HttpCode(200)
  importRows(@Body('rows') rows: EyeExamImportRow[], @Req() request: AuthenticatedRequest) { if (!Array.isArray(rows) || !rows.length) throw new BadRequestException('Không có phiếu đo hợp lệ để nhập.'); return this.eyeExamExcelService.importRows(rows, request.user!.sub); }
  @Get(':id/history') findHistory(@Param('id') id: string) { return this.eyeExamsService.findHistory(id); }
  @Get(':id') findOne(@Param('id') id: string) { return this.eyeExamsService.findOne(id); }
  @Patch(':id/lock') lock(@Param('id') id: string, @Req() request: AuthenticatedRequest) { return this.eyeExamsService.lock(id, request.user!.sub); }
  @Patch(':id/finalize') updateAndLock(@Param('id') id: string, @Body() dto: UpdateEyeExamDto, @Req() request: AuthenticatedRequest) { return this.eyeExamsService.updateAndLock(id, dto, request.user!.sub); }
  @Patch(':id/unlock') unlock(@Param('id') id: string, @Req() request: AuthenticatedRequest) { return this.eyeExamsService.unlock(id, request.user!.sub); }
  @Patch(':id/restore') restore(@Param('id') id: string, @Req() request: AuthenticatedRequest) { return this.eyeExamsService.restore(id, request.user!.sub); }
  @Post('bulk-archive') bulkArchive(@Body('ids') ids: unknown, @Req() request: AuthenticatedRequest) { return this.eyeExamsService.archiveMany(this.requiredIds(ids), request.user!.sub); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateEyeExamDto, @Req() request: AuthenticatedRequest) { return this.eyeExamsService.update(id, dto, request.user!.sub); }
  @Delete(':id') @HttpCode(204) async archive(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<void> { await this.eyeExamsService.archive(id, request.user!.sub); }

  private requiredIds(value: unknown): string[] {
    if (!Array.isArray(value)) throw new BadRequestException('Danh sách phiếu đo không hợp lệ.');
    const ids = [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))];
    if (!ids.length || ids.length > 100) throw new BadRequestException('Chỉ có thể lưu trữ từ 1 đến 100 phiếu đo mỗi lần.');
    return ids;
  }
}
