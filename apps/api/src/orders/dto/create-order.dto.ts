import { Type } from 'class-transformer';
import { OrderType, PaymentMethod } from '@prisma/client';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @Type(() => Number)
  @IsInt({ message: 'Số lượng sản phẩm phải là số nguyên.' })
  @Min(1, { message: 'Số lượng sản phẩm phải lớn hơn 0.' })
  qty!: number;
}

export class CreateOrderDto {
  @IsOptional()
  @IsEnum(OrderType)
  orderType?: OrderType;

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
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deposit?: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  depositMethod?: PaymentMethod;

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
