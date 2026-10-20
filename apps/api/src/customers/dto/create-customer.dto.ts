import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên khách hàng.' })
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^[+\d.\-\s()]+$/, { message: 'Số điện thoại không hợp lệ.' })
  phone!: string;

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
