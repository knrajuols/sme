import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ConfigClientService {
  constructor(private readonly http: HttpService) {}

  async getTenantConfiguration(tenantId: string): Promise<unknown> {
    const baseUrl = process.env.CONFIG_SERVICE_URL ?? 'http://localhost:3003';
    const response = await firstValueFrom(
      this.http.get(`${baseUrl}/configurations/${tenantId}`),
    );

    return response.data;
  }
}
