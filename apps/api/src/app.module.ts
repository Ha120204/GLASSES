import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtCookieGuard } from './auth/jwt-cookie.guard';
import { CustomersModule } from './customers/customers.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { EyeExamsModule } from './eye-exams/eye-exams.module';
import { SettingsModule } from './settings/settings.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [PrismaModule, AuthModule, CustomersModule, EyeExamsModule, SettingsModule, ProductsModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: JwtCookieGuard }],
})
export class AppModule {}
