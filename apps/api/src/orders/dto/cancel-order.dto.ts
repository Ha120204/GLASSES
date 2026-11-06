import { PaymentMethod } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export const refundAccountNamePattern = /^(?=.*\p{L})[^\p{N}]+$/u;

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

  @ValidateIf((dto: CancelOrderDto) => dto.refundMethod === PaymentMethod.TRANSFER)
  @IsString()
  @IsNotEmpty({ message: 'Nhập tên ngân hàng nhận hoàn tiền.' })
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  refundBankName?: string;

  @ValidateIf((dto: CancelOrderDto) => dto.refundMethod === PaymentMethod.TRANSFER)
  @IsString()
  @IsNotEmpty({ message: 'Nhập số tài khoản nhận hoàn tiền.' })
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  refundAccountNumber?: string;

  @ValidateIf((dto: CancelOrderDto) => dto.refundMethod === PaymentMethod.TRANSFER)
  @IsString()
  @IsNotEmpty({ message: 'Nhập tên chủ tài khoản nhận hoàn tiền.' })
  @MaxLength(120)
  @Matches(refundAccountNamePattern, { message: 'Tên chủ tài khoản phải có chữ và không được chứa số.' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  refundAccountName?: string;
}
