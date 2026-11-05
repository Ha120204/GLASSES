import { PaymentMethod } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CancelOrderDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty()
  @MinLength(3, { message: 'Vui lòng nhập lý do hủy đơn.' })
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'Hình thức hoàn tiền không hợp lệ.' })
  refundMethod?: PaymentMethod;
}
