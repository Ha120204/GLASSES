import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateOrderPaymentDto {
  @IsUUID('4', { message: 'Mã yêu cầu thanh toán không hợp lệ.' })
  idempotencyKey!: string;

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
