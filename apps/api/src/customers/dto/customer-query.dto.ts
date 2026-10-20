import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CustomerQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

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
