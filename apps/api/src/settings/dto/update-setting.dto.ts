import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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

  @IsOptional()
  @IsInt({ message: 'Số tháng nhắc tái khám phải là số nguyên.' })
  @Min(1, { message: 'Số tháng nhắc tái khám phải từ 1 đến 60.' })
  @Max(60, { message: 'Số tháng nhắc tái khám phải từ 1 đến 60.' })
  reminderMonths?: number;
}
