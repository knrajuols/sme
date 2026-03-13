import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * RFC 7807 Problem Details filter.
 *
 * All error responses produced by this application conform to
 * https://datatracker.ietf.org/doc/html/rfc7807, returning:
 *   type        – URI identifying the problem type
 *   title       – Human-readable summary (stable per type)
 *   status      – HTTP status code (mirrors the HTTP status)
 *   detail      – Human-readable explanation for this occurrence
 *   instance    – URI of the request that caused the error
 *   correlationId – Taken from the x-correlation-id request header
 *
 * Content-Type is set to "application/problem+json" as required by the spec.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private static readonly STATUS_TITLES: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };

  private static readonly STATUS_TYPES: Record<number, string> = {
    400: 'https://sme.example.com/errors/bad-request',
    401: 'https://sme.example.com/errors/unauthorized',
    403: 'https://sme.example.com/errors/forbidden',
    404: 'https://sme.example.com/errors/not-found',
    409: 'https://sme.example.com/errors/conflict',
    422: 'https://sme.example.com/errors/unprocessable-entity',
    429: 'https://sme.example.com/errors/too-many-requests',
    500: 'https://sme.example.com/errors/internal-server-error',
    502: 'https://sme.example.com/errors/bad-gateway',
    503: 'https://sme.example.com/errors/service-unavailable',
  };

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // For non-HttpException errors, expose the real message in dev so it is
    // visible in the API response and unit-test output.
    const rawExceptionMsg =
      exception instanceof Error ? exception.message : String(exception);

    const rawPayload =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: process.env.NODE_ENV === 'production' ? 'Internal server error' : rawExceptionMsg };

    // If the thrower already provided RFC 7807 fields, forward them verbatim;
    // otherwise derive them from the exception.
    const isRfc7807 =
      typeof rawPayload === 'object' &&
      rawPayload !== null &&
      'type' in rawPayload &&
      'title' in rawPayload;

    const detail: string = isRfc7807
      ? ((rawPayload as { detail?: string }).detail ?? '')
      : (() => {
          const msg =
            typeof rawPayload === 'string'
              ? rawPayload
              : ((rawPayload as { message?: string | string[] }).message ?? 'Request failed');
          return Array.isArray(msg) ? msg.join(', ') : msg;
        })();

    const correlationId =
      (request.headers['x-correlation-id'] as string | undefined) ?? undefined;

    const body: Record<string, unknown> = {
      type:
        isRfc7807
          ? (rawPayload as { type: string }).type
          : (HttpExceptionFilter.STATUS_TYPES[status] ??
            'https://sme.example.com/errors/unknown'),
      title:
        isRfc7807
          ? (rawPayload as { title: string }).title
          : (HttpExceptionFilter.STATUS_TITLES[status] ?? 'Error'),
      status,
      detail,
      instance: request.url,
      ...(correlationId ? { correlationId } : {}),
      // Forward any extra fields from the payload (e.g. moduleKey, tenantId attached by ModuleGuard)
      ...(isRfc7807
        ? (({ type: _t, title: _ti, status: _s, detail: _d, ...rest }) => rest)(
            rawPayload as Record<string, unknown>,
          )
        : {}),
    };

    response
      .status(status)
      .setHeader('Content-Type', 'application/problem+json')
      .json(body);
  }
}
