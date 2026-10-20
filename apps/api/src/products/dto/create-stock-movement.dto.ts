import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';
import { StockMovementType } from '@prisma/client';

export class CreateStockMovementDto {
  @IsEnum(StockMovementType, { message: 'Loại biến động kho không hợp lệ.' })
  type!: StockMovementType;

  @Type(() => Number)
  @IsInt({ message: 'Số lượng phải là số nguyên.' })
  @Min(1, { message: 'Số lượng phải lớn hơn 0.' })
  qty!: number;

  @ValidateIf((value: CreateStockMovementDto) => value.type === StockMovementType.ADJUST)
  @IsIn(['IN', 'OUT'], { message: 'Vui lòng chọn hướng điều chỉnh.' })
  adjustmentDirection?: 'IN' | 'OUT';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
