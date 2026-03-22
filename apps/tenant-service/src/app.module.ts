import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { dirname, join } from 'path';

import { AuthModule } from '@sme/auth';
import { SmeLoggerModule } from '@sme/logger';
import { MessagingModule } from '@sme/messaging';

import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';
import { AnalyticsController } from './analytics.controller';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AnalyticsService } from './analytics.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';
import { ExamScheduleController } from './exam-schedule.controller';
import { HealthController } from './health.controller';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { PlatformController } from './platform.controller';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';
import { TimetableController } from './timetable.controller';
import { TimetableService } from './timetable.service';
import { TransportController } from './transport.controller';
import { TransportPortalController } from './transport-portal.controller';
import { TransportService } from './transport.service';
import { TransportAllocationController } from './transport-allocation.controller';
import { TransportAllocationPortalController } from './transport-allocation-portal.controller';
import { TransportAllocationService } from './transport-allocation.service';
import { TransportAnalyticsPortalController } from './transport-analytics-portal.controller';
import { TransportAnalyticsService } from './transport-analytics.service';
import { StaffAuthController } from './staff-auth.controller';
import { StaffAuthService } from './staff-auth.service';
import { WebAdminController } from './web-admin.controller';
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
    DashboardController,
    PortalController,
    FinanceController,
    TimetableController,
    WebAdminController,
    ExamScheduleController,
    HrController,
    TransportController,
    TransportPortalController,
    TransportAllocationController,
    TransportAllocationPortalController,
    TransportAnalyticsPortalController,
    StaffAuthController,
  ],
  providers: [
    AppService,
    RabbitMqSetupService,
    AcademicService,
    AttendanceService,
    ExamService,
    HrService,
    AnalyticsService,
    DashboardService,
    PortalService,
    FinanceService,
    TimetableService,
    TransportService,
    TransportAllocationService,
    TransportAnalyticsService,
    StaffAuthService,
  ],
})
export class AppModule {}
