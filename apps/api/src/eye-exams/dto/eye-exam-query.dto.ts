import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class EyeExamQueryDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsDateString({}, { message: 'Từ ngày không hợp lệ.' }) dateFrom?: string;
  @IsOptional() @IsDateString({}, { message: 'Đến ngày không hợp lệ.' }) dateTo?: string;
  @IsOptional() @IsIn(['DRAFT', 'LOCKED'], { message: 'Trạng thái phiếu đo không hợp lệ.' }) status?: 'DRAFT' | 'LOCKED';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 10;
}
