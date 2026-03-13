import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ConfigClientService {
  private readonly logger = new Logger(ConfigClientService.name);

  /** In-process TTL cache: `${tenantId}:${moduleKey}` → enabled (true/false) */
  private readonly moduleCache = new Map<string, { enabled: boolean; expiresAt: number }>();

  /** Cache TTL in ms: 30 seconds. Config service is authoritative — keep TTL short. */
  private static readonly CACHE_TTL_MS = 30_000;

  constructor(private readonly http: HttpService) {}

  async getTenantConfiguration(tenantId: string): Promise<unknown> {
    const baseUrl = process.env.CONFIG_SERVICE_URL ?? 'http://localhost:3003';
    const response = await firstValueFrom(
      this.http.get(`${baseUrl}/configurations/${tenantId}`),
    );
    return response.data;
  }

  /**
   * Checks whether a module is enabled for a tenant.
   * Caches results for 30 s to avoid hammering the config-service on every request.
   * Fails-open on network errors (returns true) for availability.
   */
  async isModuleEnabled(tenantId: string, moduleKey: string): Promise<boolean> {
    const cacheKey = `${tenantId}:${moduleKey}`;
    const cached = this.moduleCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.enabled;
    }

    try {
      const baseUrl = process.env.CONFIG_SERVICE_URL ?? 'http://localhost:3003';
      const response = await firstValueFrom(
        this.http.get<{ tenantId: string; modules: Array<{ moduleKey: string; enabled: boolean }> }>(
          `${baseUrl}/configurations/${tenantId}/modules`,
        ),
      );

      const modules: Array<{ moduleKey: string; enabled: boolean }> = response.data?.modules ?? [];
      const expiresAt = Date.now() + ConfigClientService.CACHE_TTL_MS;

      for (const m of modules) {
        this.moduleCache.set(`${tenantId}:${m.moduleKey}`, { enabled: m.enabled, expiresAt });
      }

      const found = modules.find((m) => m.moduleKey === moduleKey);
      // Unknown modules default to true (fail-open for forward-compatibility)
      return found?.enabled ?? true;
    } catch (err) {
      this.logger.warn(
        `Module check unavailable for tenant=${tenantId} module=${moduleKey}: ${(err as Error).message}. Failing open.`,
      );
      return true;
    }
  }
}
