import { Module } from '@nestjs/common';
import { EyeExamsController } from './eye-exams.controller';
import { EyeExamsService } from './eye-exams.service';
@Module({ controllers: [EyeExamsController], providers: [EyeExamsService], exports: [EyeExamsService] })
export class EyeExamsModule {}
