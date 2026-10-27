import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { EyeExamsModule } from '../eye-exams/eye-exams.module';
import { CustomerExcelService } from './customer-excel.service';

@Module({
  imports: [EyeExamsModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomerExcelService],
})
export class CustomersModule {}
