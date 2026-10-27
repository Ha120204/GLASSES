import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ProductType } from '@prisma/client';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mã sản phẩm.' })
  @MaxLength(80)
  sku!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  barcode?: string | null;

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
  costPrice!: number;

  @Type(() => Number)
  @IsInt({ message: 'Giá bán phải là số nguyên.' })
  @Min(0, { message: 'Giá bán không được âm.' })
  salePrice!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplier?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  autoSku?: boolean;
}
