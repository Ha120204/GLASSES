import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; user: { id: string; email: string; name: string; role: UserRole } }> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }
    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }

  async me(userId: string): Promise<{ id: string; email: string; name: string; role: UserRole }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) throw new UnauthorizedException('Tài khoản không còn tồn tại.');
    return user;
  }
}
