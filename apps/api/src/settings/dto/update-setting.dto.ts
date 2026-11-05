import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { vietQrBanks } from '@glasses/shared';

export class UpdateSettingDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên cửa hàng.' })
  @MaxLength(120)
  storeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.replace(/[\s().-]/g, '') || null : value)
  @IsString()
  @Matches(/^(?:\+84|0)\d{9,10}$/, { message: 'Nhập số điện thoại Việt Nam hợp lệ.' })
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() || null : value)
  @IsString()
  @MaxLength(24)
  @Matches(/^[A-Z0-9-]{1,24}$/, { message: 'Tiền tố chỉ gồm chữ in hoa, số và dấu gạch ngang.' })
  invoiceTemplate?: string | null;

  @IsOptional()
  @IsBoolean()
  qrPaymentEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Mã BIN VietQR gồm 6 chữ số.' })
  @IsIn(vietQrBanks.map((bank) => bank.bin), { message: 'Chọn ngân hàng có trong danh sách VietQR.' })
  bankBin?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6,30}$/, { message: 'Số tài khoản chỉ gồm 6 đến 30 chữ số.' })
  bankAccountNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankAccountName?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9-]{1,24}$/, { message: 'Tiền tố chỉ gồm chữ in hoa, số và dấu gạch ngang.' })
  transferContentPrefix?: string;
}
