import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateEyeExamDto } from './dto/create-eye-exam.dto';
import { EyeExamQueryDto } from './dto/eye-exam-query.dto';
import { UpdateEyeExamDto } from './dto/update-eye-exam.dto';
import { EyeExamsService } from './eye-exams.service';

@Controller('eye-exams')
export class EyeExamsController {
  constructor(private readonly eyeExamsService: EyeExamsService) {}
  @Post() create(@Body() dto: CreateEyeExamDto) { return this.eyeExamsService.create(dto); }
  @Get() findAll(@Query() query: EyeExamQueryDto) { return this.eyeExamsService.findAll(query); }
  @Get('config') getConfig() { return this.eyeExamsService.getConfig(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.eyeExamsService.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateEyeExamDto) { return this.eyeExamsService.update(id, dto); }
  @Delete(':id') @HttpCode(204) async remove(@Param('id') id: string): Promise<void> { await this.eyeExamsService.remove(id); }
}
