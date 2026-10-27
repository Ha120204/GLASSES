import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateOrderPaymentDto {
  @IsInt({ message: 'Số tiền thanh toán phải là số nguyên.' })
  @Min(1, { message: 'Số tiền thanh toán phải lớn hơn 0.' })
  amount!: number;

  @IsEnum(PaymentMethod, { message: 'Hình thức thanh toán không hợp lệ.' })
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
