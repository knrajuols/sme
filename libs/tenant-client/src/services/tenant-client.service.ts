import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TenantClientService {
  constructor(private readonly http: HttpService) {}

  async createPlatformTenant(
    payload: {
      tenantCode: string;
      schoolName: string;
      primaryContactName: string;
      primaryContactEmail: string;
      primaryContactPhone: string;
      status?: string;
      planId?: string;
      adminUserId?: string;
    },
    context: { correlationId: string; actorId: string; actorRole: string; tenantId: string; accessToken: string },
  ): Promise<{ tenantId: string; tenantCode: string }> {
    const baseUrl = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';
    const response = await firstValueFrom(
      this.http.post(`${baseUrl}/platform/tenants`, payload, {
        headers: {
          'x-correlation-id': context.correlationId,
          'x-actor-id': context.actorId,
          'x-actor-role': context.actorRole,
          'x-tenant-id': context.tenantId,
          authorization: `Bearer ${context.accessToken}`,
          'x-api-key': process.env.INTERNAL_API_KEY,
        },
      }),
    );

    return response.data.data as { tenantId: string; tenantCode: string };
  }

  async getTenantByCode(code: string): Promise<unknown> {
    const baseUrl = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';
    const response = await firstValueFrom(this.http.get(`${baseUrl}/tenants/${code}`));
    return response.data;
  }
}
