import { IsDateString, IsOptional } from 'class-validator';

export class ReportQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ.' })
  dateFrom?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ.' })
  dateTo?: string;
}
