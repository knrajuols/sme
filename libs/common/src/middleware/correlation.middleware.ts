import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Correlation Middleware
 *
 * Ensures every inbound request carries an x-correlation-id header.
 * If the client did not provide one the gateway generates a UUID v4.
 * The ID is stamped on the response so the caller can reference it.
 *
 * All downstream log lines MUST include this ID for end-to-end tracing.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-correlation-id'];
    const correlationId =
      typeof incoming === 'string' && incoming.trim().length > 0
        ? incoming.trim()
        : randomUUID();

    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    next();
  }
}
