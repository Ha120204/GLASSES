import { IsEnum } from 'class-validator';
import { ProductType } from '@prisma/client';

export class SkuSuggestionQueryDto {
  @IsEnum(ProductType)
  type!: ProductType;
}
