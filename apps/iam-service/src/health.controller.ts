import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@sme/auth';

import { AppService } from './app.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly appService: AppService) {}

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'IAM liveness probe' })
  live(): { status: string; service: string } {
    return this.appService.live();
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'IAM readiness probe' })
  async ready(): Promise<{ status: string; service: string }> {
    const readiness = await this.appService.readiness();

    if (!readiness.ok) {
      throw new ServiceUnavailableException({
        message: 'Service readiness check failed',
        code: 'HEALTH_READY_FAILED',
        details: readiness.details,
      });
    }

    return this.appService.live();
  }
}
