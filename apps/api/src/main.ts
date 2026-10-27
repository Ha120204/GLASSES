import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) ?? [
    'http://localhost:3000',
  ];
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({ origin: corsOrigin, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(Number(process.env.PORT ?? 4000));
}

void bootstrap();
