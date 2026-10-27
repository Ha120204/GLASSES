import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsQuarterStep } from './quarter-step.validator';

const toNumber = ({ value }: { value: unknown }): unknown => value === '' || value === undefined ? undefined : value === null ? null : Number(value);

export class UpdateEyeExamDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsDateString({}, { message: 'Ngày đo không hợp lệ.' }) examDate?: string;
  @IsOptional() @IsString() @MaxLength(120) examiner?: string;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(-30) @Max(30) @IsQuarterStep() rSph?: number;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(-30) @Max(30) @IsQuarterStep() rCyl?: number;
  @IsOptional() @Transform(toNumber) @IsInt() @Min(0) @Max(180) rAxis?: number;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(0) @Max(4) @IsQuarterStep() rAdd?: number;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(20) @Max(80) rPd?: number;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(40) @Max(80) pdTotal?: number;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(0) @Max(20) @IsQuarterStep() rPrism?: number;
  @IsOptional() @IsIn(['BI', 'BO', 'BU', 'BD']) rBase?: string;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(5) @Max(50) rSegHeight?: number;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(-30) @Max(30) @IsQuarterStep() lSph?: number;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(-30) @Max(30) @IsQuarterStep() lCyl?: number;
  @IsOptional() @Transform(toNumber) @IsInt() @Min(0) @Max(180) lAxis?: number;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(0) @Max(4) @IsQuarterStep() lAdd?: number;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(20) @Max(80) lPd?: number;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(0) @Max(20) @IsQuarterStep() lPrism?: number;
  @IsOptional() @IsIn(['BI', 'BO', 'BU', 'BD']) lBase?: string;
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(5) @Max(50) lSegHeight?: number;
  @IsOptional() @IsIn(['DISTANCE', 'NEAR', 'INTERMEDIATE', 'MULTIPURPOSE']) wearingPurpose?: string;
  @IsOptional() @IsIn(['SINGLE_VISION', 'BIFOCAL', 'PROGRESSIVE']) lensDesign?: string;
  @IsOptional() @IsBoolean() noPrescription?: boolean;
  @IsOptional() @IsString() @MaxLength(500) noPrescriptionReason?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
