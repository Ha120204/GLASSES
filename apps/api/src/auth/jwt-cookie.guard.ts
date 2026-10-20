import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';

export interface AuthenticatedRequest extends Request {
  user?: { sub: string; email: string; name: string };
}

@Injectable()
export class JwtCookieGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.access_token as string | undefined;
    if (!token) throw new UnauthorizedException('Vui lòng đăng nhập để tiếp tục.');
    try {
      request.user = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        name: string;
      }>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }
  }
}
