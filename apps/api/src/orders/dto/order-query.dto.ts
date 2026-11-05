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
  @IsEnum(OrderStatus, { message: 'Tình trạng đơn hàng không hợp lệ.' })
  status?: OrderStatus;

  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED'], { message: 'Chế độ lưu trữ không hợp lệ.' })
  archiveView: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE';

  @IsOptional()
  @IsIn(['IN_PROGRESS', 'TODAY', 'OVERDUE'], { message: 'Bộ lọc công việc không hợp lệ.' })
  workFilter?: 'IN_PROGRESS' | 'TODAY' | 'OVERDUE';

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
  @IsIn(['asc', 'desc'], { message: 'Thứ tự sắp xếp không hợp lệ.' })
  sortDirection: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang phải là số nguyên.' })
  @Min(1, { message: 'Số trang phải từ 1 trở lên.' })
  page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt({ message: 'Số dòng mỗi trang phải là số nguyên.' })
  @Min(1, { message: 'Số dòng mỗi trang phải từ 1 trở lên.' })
  @Max(100, { message: 'Số dòng mỗi trang không được quá 100.' })
  pageSize = 10;
}
