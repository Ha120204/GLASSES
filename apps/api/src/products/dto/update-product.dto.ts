import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { ProductType } from '@prisma/client';

export class UpdateProductDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mã sản phẩm.' })
  @MaxLength(80)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  barcode?: string | null;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên sản phẩm.' })
  @MaxLength(200)
  name?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsEnum(ProductType, { message: 'Loại sản phẩm không hợp lệ.' })
  type?: ProductType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string | null;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt({ message: 'Giá vốn phải là số nguyên.' })
  @Min(0, { message: 'Giá vốn không được âm.' })
  @Max(2147483647, { message: 'Giá vốn vượt quá giới hạn cho phép.' })
  costPrice?: number;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt({ message: 'Giá bán phải là số nguyên.' })
  @Min(0, { message: 'Giá bán không được âm.' })
  @Max(2147483647, { message: 'Giá bán vượt quá giới hạn cho phép.' })
  salePrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplier?: string | null;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  active?: boolean;
}
