import { Transform, Type } from 'class-transformer';
import { StockMovementType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class StockMovementHistoryQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

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
  pageSize = 20;
}
