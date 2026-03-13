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

  // ── CORS ──────────────────────────────────────────────────────────────────
  // Static origins from env (comma-separated)
  const staticOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3101,http://localhost:3102')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // Dynamic origin matcher — allows any subdomain of the configured base domain
  // e.g. http://greenvalley.sme.test:3102, http://school2.sme.test:3102
  // TODO (Production Migration): update BASE_DOMAIN to your real domain
  const baseDomain = (process.env.BASE_DOMAIN ?? 'sme.test').replace('.', '\\.');
  const subdomainPattern = new RegExp(`^https?://[a-z0-9-]+\\.${baseDomain}(:\\d+)?$`);

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (server-to-server, curl, Swagger)
      if (!origin) return callback(null, true);
      if (staticOrigins.includes(origin) || subdomainPattern.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
  });


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
    .setTitle('SME API Gateway')
    .setDescription('Entry point for School Management Excellence microservices')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
