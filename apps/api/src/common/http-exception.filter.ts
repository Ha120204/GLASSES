import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttpException ? exception.getResponse() : null;
    const message = this.getMessage(payload, status);

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private getMessage(payload: string | object | null, status: number): string | string[] {
    if (typeof payload === 'string') return payload;
    if (payload && 'message' in payload) {
      const message = payload.message;
      if (typeof message === 'string' || Array.isArray(message)) return message;
    }
    return status >= 500 ? 'Đã xảy ra lỗi hệ thống.' : 'Yêu cầu không hợp lệ.';
  }
}
