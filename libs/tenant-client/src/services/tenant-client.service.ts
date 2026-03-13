import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

/** Extract the most useful error message from a downstream Axios error. */
function rethrowAxios(err: unknown, fallback: string): never {
  if (err instanceof AxiosError && err.response) {
    const d = err.response.data as Record<string, unknown> | undefined;
    const msg =
      (typeof d?.detail === 'string' && d.detail)   ? d.detail   :
      (typeof d?.message === 'string' && d.message) ? d.message  :
      (Array.isArray(d?.message) ? (d!.message as string[]).join(', ') : null) ??
      err.message ?? fallback;
    throw new HttpException(msg, err.response.status || HttpStatus.BAD_GATEWAY);
  }
  throw err instanceof Error ? new HttpException(err.message || fallback, HttpStatus.BAD_GATEWAY) : new HttpException(fallback, HttpStatus.BAD_GATEWAY);
}

@Injectable()
export class TenantClientService {
  constructor(private readonly http: HttpService) {}

  async listAllTenants(
    context: { correlationId: string; actorId: string; actorRole: string; tenantId: string; accessToken: string },
  ): Promise<Array<Record<string, unknown>>> {
    const baseUrl = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';
    try {
      const response = await firstValueFrom(
        this.http.get(`${baseUrl}/platform/tenants`, {
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
      return response.data.data as Array<Record<string, unknown>>;
    } catch (err) { rethrowAxios(err, 'Failed to list all tenants'); }
  }

  async updateTenant(
    tenantId: string,
    dto: Record<string, unknown>,
    context: { correlationId: string; actorId: string; actorRole: string; tenantId: string; accessToken: string },
  ): Promise<{ tenantId: string; updated: boolean }> {
    const baseUrl = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';
    try {
      const response = await firstValueFrom(
        this.http.patch(`${baseUrl}/platform/tenants/${tenantId}`, dto, {
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
      return response.data.data as { tenantId: string; updated: boolean };
    } catch (err) { rethrowAxios(err, 'Failed to update tenant'); }
  }

  async listPendingTenants(
    context: { correlationId: string; actorId: string; actorRole: string; tenantId: string; accessToken: string },
  ): Promise<Array<{ tenantId: string; tenantCode: string; schoolName: string; status: string; createdAt: string }>> {
    const baseUrl = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';
    try {
      const response = await firstValueFrom(
        this.http.get(`${baseUrl}/platform/tenants/pending`, {
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
      return response.data.data as Array<{ tenantId: string; tenantCode: string; schoolName: string; status: string; createdAt: string }>;
    } catch (err) { rethrowAxios(err, 'Failed to list pending tenants'); }
  }

  async createPlatformTenant(
    payload: {
      tenantCode: string;
      schoolName: string;
      udiseCode?: string;
      address?: string;
      city?: string;
      state?: string;
      pincode?: string;
      primaryContactName: string;
      primaryContactEmail: string;
      primaryContactPhone?: string;
      status?: string;
      planId?: string;
      adminUserId?: string;
    },
    context: { correlationId: string; actorId: string; actorRole: string; tenantId: string; accessToken: string },
  ): Promise<{ tenantId: string; tenantCode: string }> {
    const baseUrl = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';
    try {
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
    } catch (err) { rethrowAxios(err, 'Failed to create tenant'); }
  }

  async getTenantByCode(code: string): Promise<unknown> {
    const baseUrl = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';
    const response = await firstValueFrom(this.http.get(`${baseUrl}/tenants/${code}`));
    return response.data;
  }

  async getTenantProfileById(tenantId: string): Promise<{ tenantId: string; tenantCode: string; schoolName: string; status: string }> {
    const baseUrl = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';
    const response = await firstValueFrom(this.http.get(`${baseUrl}/tenants/profile/${tenantId}`));
    return response.data.data as { tenantId: string; tenantCode: string; schoolName: string; status: string };
  }

  async activateTenant(
    tenantId: string,
    context: { correlationId: string; actorId: string; actorRole: string; tenantId: string; accessToken: string },
  ): Promise<{ tenantId: string; status: string }> {
    const baseUrl = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';
    try {
      const response = await firstValueFrom(
        this.http.post(
          `${baseUrl}/platform/tenants/${tenantId}/activate`,
          {},
          {
            headers: {
              'x-correlation-id': context.correlationId,
              'x-actor-id': context.actorId,
              'x-actor-role': context.actorRole,
              'x-tenant-id': context.tenantId,
              authorization: `Bearer ${context.accessToken}`,
              'x-api-key': process.env.INTERNAL_API_KEY,
            },
          },
        ),
      );
      return response.data.data as { tenantId: string; status: string };
    } catch (err) { rethrowAxios(err, 'Failed to activate tenant'); }
  }

  async getFullTenantProfile(tenantId: string): Promise<Record<string, unknown>> {
    const baseUrl = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';
    try {
      const response = await firstValueFrom(
        this.http.get(`${baseUrl}/tenants/full-profile/${tenantId}`),
      );
      return response.data.data as Record<string, unknown>;
    } catch (err) { rethrowAxios(err, 'Failed to get full tenant profile'); }
  }

  async updateOwnTenantProfile(
    tenantId: string,
    dto: Record<string, unknown>,
    context: { correlationId: string; actorId: string; actorRole: string; tenantId: string; accessToken: string },
  ): Promise<{ tenantId: string; updated: boolean }> {
    const baseUrl = process.env.TENANT_SERVICE_URL ?? 'http://localhost:3002';
    try {
      const response = await firstValueFrom(
        this.http.patch(`${baseUrl}/tenants/own-profile/${tenantId}`, dto, {
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
      return response.data.data as { tenantId: string; updated: boolean };
    } catch (err) { rethrowAxios(err, 'Failed to update own tenant profile'); }
  }
}
