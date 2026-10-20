import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class StockMovementQueryDto {
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
