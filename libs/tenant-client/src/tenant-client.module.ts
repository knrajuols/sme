import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { TenantClientService } from './services/tenant-client.service';

@Module({
  imports: [HttpModule],
  providers: [TenantClientService],
  exports: [TenantClientService],
})
export class TenantClientModule {}
