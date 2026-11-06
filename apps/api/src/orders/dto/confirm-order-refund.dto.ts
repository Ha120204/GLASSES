import { Equals, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ConfirmOrderRefundDto {
  @IsBoolean()
  @Equals(true, { message: 'Xác nhận đã trả tiền cho khách trước khi ghi nhận hoàn tiền.' })
  confirmed!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  note?: string;
}
