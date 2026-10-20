import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ProductType } from '@prisma/client';

export class ProductQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
}
