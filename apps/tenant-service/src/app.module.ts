import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { dirname, join } from 'path';

import { AuthModule } from '@sme/auth';
import { SmeLoggerModule } from '@sme/logger';
import { MessagingModule } from '@sme/messaging';

import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';
import { HealthController } from './health.controller';
import { PlatformController } from './platform.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RabbitMqSetupService } from './rabbitmq-setup.service';

const appRoot = dirname(process.env.npm_package_json ?? join(process.cwd(), 'package.json'));

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvVars: true,
      envFilePath: [
        join(appRoot, `.env.${process.env.NODE_ENV ?? 'development'}`),
        join(appRoot, '.env'),
      ],
    }),
    AuthModule,
    SmeLoggerModule,
    MessagingModule,
    PrismaModule,
  ],
  controllers: [
    AppController,
    HealthController,
    PlatformController,
    AcademicController,
    AttendanceController,
    ExamController,
    AnalyticsController,
  ],
  providers: [
    AppService,
    RabbitMqSetupService,
    AcademicService,
    AttendanceService,
    ExamService,
    AnalyticsService,
  ],
})
export class AppModule {}
