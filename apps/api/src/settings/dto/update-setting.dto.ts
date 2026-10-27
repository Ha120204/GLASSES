import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  storeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  invoiceTemplate?: string | null;

}
