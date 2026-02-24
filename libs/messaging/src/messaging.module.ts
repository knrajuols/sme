import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MessagePublisherService } from './services/message-publisher.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [MessagePublisherService],
  exports: [MessagePublisherService],
})
export class MessagingModule {}
