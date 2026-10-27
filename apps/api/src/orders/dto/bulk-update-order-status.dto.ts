import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsString } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class BulkUpdateOrderStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Type(() => String)
  ids!: string[];

  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
