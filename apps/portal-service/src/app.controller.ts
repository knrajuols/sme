import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '@sme/auth';

import { AppService } from './app.service';

@ApiTags('Portal')
@Controller('portal')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Portal service health check with DB ping' })
  async health(): Promise<{ service: string; status: string }> {
    return this.appService.health();
  }

  @Get('internal/health')
  @ApiOperation({ summary: 'Portal internal health endpoint (requires internal secret + JWT)' })
  internalHealth(): { service: string; status: string } {
    return this.appService.live();
  }
}
