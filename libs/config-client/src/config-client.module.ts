import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { ConfigClientService } from './services/config-client.service';

@Module({
  imports: [HttpModule],
  providers: [ConfigClientService],
  exports: [ConfigClientService],
})
export class ConfigClientModule {}
