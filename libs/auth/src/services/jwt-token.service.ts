import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

import type { JwtClaims } from '../interfaces/jwt-claims.interface';

interface TokenInput {
  sub: string;
  tenantId: string;
  roles: string[];
  permissions?: string[];
  sessionId: string;
  /** Login email — embedded in token for UI display only. */
  email?: string;
  expiresInSeconds?: number;
}

interface Header {
  alg: 'HS256';
  typ: 'JWT';
}

@Injectable()
export class JwtTokenService {
  constructor(private readonly configService: ConfigService) {}

  issueToken(input: TokenInput): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresIn = input.expiresInSeconds ?? Number(this.configService.get<string>('JWT_EXPIRES_IN_SECONDS') ?? '3600');
    const payload: JwtClaims = {
      sub: input.sub,
      tenantId: input.tenantId,
      roles: input.roles,
      permissions: input.permissions ?? [],
      sessionId: input.sessionId,
      ...(input.email ? { email: input.email } : {}),
      iat: issuedAt,
      exp: issuedAt + expiresIn,
    };

    const encodedHeader = this.base64UrlEncodeJson({ alg: 'HS256', typ: 'JWT' } satisfies Header);
    const encodedPayload = this.base64UrlEncodeJson(payload);
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  verifyToken(token: string): JwtClaims {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid bearer token format');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const expectedSignature = this.sign(`${encodedHeader}.${encodedPayload}`);

    const providedBuffer = Buffer.from(encodedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid bearer token signature');
    }

    const header = this.base64UrlDecodeJson<Header>(encodedHeader);
    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      throw new UnauthorizedException('Invalid token header');
    }

    const payload = this.base64UrlDecodeJson<JwtClaims>(encodedPayload);
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) {
      throw new UnauthorizedException('Token has expired');
    }

    if (!payload.sub || !payload.tenantId || !Array.isArray(payload.roles) || !payload.sessionId) {
      throw new UnauthorizedException('Token payload is invalid');
    }

    return payload;
  }

  private sign(payload: string): string {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('JWT secret is not configured');
    }

    return createHmac('sha256', secret)
      .update(payload)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  private base64UrlEncodeJson(value: unknown): string {
    return Buffer.from(JSON.stringify(value), 'utf8')
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  private base64UrlDecodeJson<T>(value: string): T {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    const text = Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
    return JSON.parse(text) as T;
  }
}