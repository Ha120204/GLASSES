import { Module } from '@nestjs/common';
import { EyeExamsController } from './eye-exams.controller';
import { EyeExamsService } from './eye-exams.service';
import { EyeExamExcelService } from './eye-exam-excel.service';
@Module({ controllers: [EyeExamsController], providers: [EyeExamsService, EyeExamExcelService], exports: [EyeExamsService] })
export class EyeExamsModule {}
