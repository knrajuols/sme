import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const message =
      typeof payload === 'string'
        ? payload
        : (payload as { message?: string | string[] }).message ??
          'Request failed';

    response.status(status).json({
      status: 'fail',
      message: Array.isArray(message) ? message.join(', ') : message,
      data: null,
      error: {
        code:
          exception instanceof HttpException
            ? exception.name
            : 'INTERNAL_SERVER_ERROR',
        details:
          typeof payload === 'string'
            ? { path: request.url }
            : payload,
      },
    });
  }
}
