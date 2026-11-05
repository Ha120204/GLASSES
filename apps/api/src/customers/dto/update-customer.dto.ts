import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { customerNamePattern, normalizeCustomerName } from '../customer-name.util';
import { normalizePhone, vietnamPhonePattern } from '../phone.util';

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? normalizeCustomerName(value) : value)
  @MaxLength(120)
  @Matches(customerNamePattern, { message: 'Họ tên chỉ được gồm chữ cái, khoảng trắng, dấu gạch nối hoặc dấu nháy đơn.' })
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? normalizePhone(value) : value)
  @Matches(vietnamPhonePattern, { message: 'Nhập số điện thoại Việt Nam 10 số hợp lệ.' })
  phone?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh không hợp lệ.' })
  birthday?: string;

  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'OTHER'], { message: 'Giới tính không hợp lệ.' })
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
