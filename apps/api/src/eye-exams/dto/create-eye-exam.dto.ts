import { Transform } from 'class-transformer';
import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsQuarterStep } from './quarter-step.validator';

const toNumber = ({ value }: { value: unknown }): unknown =>
  value === '' || value === null || value === undefined ? undefined : Number(value);

export class CreateEyeExamDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn khách hàng.' })
  customerId!: string;

  @IsDateString({}, { message: 'Ngày đo không hợp lệ.' })
  examDate!: string;

  @IsOptional() @IsString() @MaxLength(120) examiner?: string;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(-30) @Max(30) @IsQuarterStep() rSph?: number;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(-30) @Max(30) @IsQuarterStep() rCyl?: number;
  @IsOptional() @Transform(toNumber) @IsInt() @Min(0) @Max(180) rAxis?: number;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(0) @Max(4) @IsQuarterStep() rAdd?: number;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(20) @Max(80) rPd?: number;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(-30) @Max(30) @IsQuarterStep() lSph?: number;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(-30) @Max(30) @IsQuarterStep() lCyl?: number;
  @IsOptional() @Transform(toNumber) @IsInt() @Min(0) @Max(180) lAxis?: number;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(0) @Max(4) @IsQuarterStep() lAdd?: number;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(20) @Max(80) lPd?: number;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @IsOptional() @IsDateString({}, { message: 'Ngày nhắc tái khám không hợp lệ.' }) nextReminderDate?: string | null;
}
