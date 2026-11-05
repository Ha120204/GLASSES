import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { ProductType } from '@prisma/client';

export class CreateProductDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mã sản phẩm.' })
  @MaxLength(80)
  sku!: string;

  @ValidateIf((dto: CreateProductDto) => dto.autoSku === true || dto.idempotencyKey !== undefined)
  @IsUUID('4', { message: 'Mã yêu cầu tạo sản phẩm không hợp lệ.' })
  idempotencyKey?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(80)
  barcode?: string | null;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên sản phẩm.' })
  @MaxLength(200)
  name!: string;

  @IsEnum(ProductType, { message: 'Loại sản phẩm không hợp lệ.' })
  type!: ProductType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string | null;

  @Type(() => Number)
  @IsInt({ message: 'Giá vốn phải là số nguyên.' })
  @Min(0, { message: 'Giá vốn không được âm.' })
  @Max(2147483647, { message: 'Giá vốn vượt quá giới hạn cho phép.' })
  costPrice!: number;

  @Type(() => Number)
  @IsInt({ message: 'Giá bán phải là số nguyên.' })
  @Min(0, { message: 'Giá bán không được âm.' })
  @Max(2147483647, { message: 'Giá bán vượt quá giới hạn cho phép.' })
  salePrice!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplier?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  autoSku?: boolean;
}
