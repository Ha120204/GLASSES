import { Transform, Type } from 'class-transformer';
import { OrderStatus } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class OrderQueryDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsIn(['ACTION_NEEDED', 'TODAY', 'OVERDUE'])
  workFilter?: 'ACTION_NEEDED' | 'TODAY' | 'OVERDUE';

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  paymentOutstanding?: boolean;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ.' })
  dateFrom?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ.' })
  dateTo?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
}
