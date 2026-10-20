import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu.' })
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự.' })
  password!: string;
}
