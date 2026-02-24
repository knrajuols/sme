import { ValidationPipe } from '@nestjs/common';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { dirname, join } from 'path';
import { Logger } from 'nestjs-pino';

import { HttpExceptionFilter, ResponseEnvelopeInterceptor } from '@sme/common';

import { AppModule } from './app.module';

const appRoot = dirname(process.env.npm_package_json ?? join(process.cwd(), 'package.json'));
const envByName = join(appRoot, `.env.${process.env.NODE_ENV ?? 'development'}`);
const envPath = existsSync(envByName) ? envByName : join(appRoot, '.env');
loadEnv({ path: envPath, override: true });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SME Tenant Service')
    .setDescription('Tenant management service')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(Number(process.env.PORT ?? 3002));
}

void bootstrap();
