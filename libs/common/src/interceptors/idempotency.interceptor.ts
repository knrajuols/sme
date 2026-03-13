import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Observable, of, tap } from 'rxjs';

/**
 * Idempotency Interceptor (RISK-06 fix)
 *
 * Any mutation endpoint (POST / PUT / PATCH / DELETE) that includes the
 * `x-idempotency-key` header will only be processed ONCE within the TTL window.
 *
 * Subsequent requests with the same key (within TTL) receive the cached response
 * immediately without re-executing the handler.
 *
 * Key is scoped per tenant to prevent cross-tenant replay collisions.
 *
 * Production note: Replace the in-process Map with a Redis SETNX call using the
 * same key format: `idempotency:{tenantId}:{keyHash}` with a 24h TTL.
 */

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  responseStatus: number;
  responseBody: unknown;
  expiresAt: number;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      path: string;
      headers: Record<string, string | string[] | undefined>;
      user?: { tenantId?: string };
    }>();

    if (!MUTATION_METHODS.has(request.method)) {
      return next.handle();
    }

    const rawKey = this.extractHeader(request.headers, 'x-idempotency-key');
    if (!rawKey) {
      return next.handle();
    }

    const tenantId = request.user?.tenantId ?? 'anonymous';
    const cacheKey = this.buildCacheKey(tenantId, rawKey);

    this.evictExpiredEntries();

    const existing = this.cache.get(cacheKey);
    if (existing && existing.expiresAt > Date.now()) {
      this.logger.debug(
        `Idempotent replay: key=${rawKey} tenantId=${tenantId} path=${request.path}`,
      );

      const response = context.switchToHttp().getResponse<{
        status: (code: number) => { json: (body: unknown) => void };
      }>();
      response.status(existing.responseStatus);
      return of(existing.responseBody);
    }

    return next.handle().pipe(
      tap((responseBody) => {
        const res = context.switchToHttp().getResponse<{ statusCode: number }>();
        this.cache.set(cacheKey, {
          responseStatus: res.statusCode,
          responseBody,
          expiresAt: Date.now() + TTL_MS,
        });
      }),
    );
  }

  private buildCacheKey(tenantId: string, rawKey: string): string {
    const hash = createHash('sha256')
      .update(`${tenantId}:${rawKey}`)
      .digest('hex');
    return `idempotency:${tenantId}:${hash}`;
  }

  private extractHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(value)) return value[0];
    return typeof value === 'string' ? value : undefined;
  }

  private evictExpiredEntries(): void {
    // Only run cleanup on ~1% of requests to avoid overhead
    if (Math.random() > 0.01) return;

    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}
