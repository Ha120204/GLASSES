import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { CreateOrderItemDto } from './create-order.dto';

export class UpdateOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn khách hàng.' })
  customerId!: string;

  @IsOptional()
  @IsString()
  eyeExamId?: string | null;

  @IsArray()
  @ArrayMinSize(1, { message: 'Đơn hàng phải có ít nhất một sản phẩm.' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsDateString()
  warrantyUntil?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
