

Round 2 - Copilot PROMPT 1 (Monorepo Scaffold).

You are GPT-5.3-Codex acting as a senior NestJS microservices architect.

Goal: Scaffold a monorepo for "SME – School Management Excellence" at C:\projects\SME using NestJS + TypeScript.

Tech stack:
- NestJS latest
- Prisma ORM
- PostgreSQL (native running at localhost:5432)
- Redis (localhost:6379)
- RabbitMQ (localhost:5672)
- npm workspaces (not yarn)
- Swagger
- pino logger

Architecture:
Monorepo with:
apps/
  api-gateway
  iam-service
  tenant-service
  config-service
  audit-service

libs/
  common
  auth
  messaging
  config-client
  tenant-client
  logger

Requirements:

1) Root package.json with npm workspaces.
2) tsconfig base.
3) eslint + prettier config.
4) README with local run instructions.
5) No docker-compose for Postgres.
6) Each service must have its own Prisma schema and connect to:
   - iam-service → sme_iam
   - tenant-service → sme_tenant
   - config-service → sme_config
   - audit-service → sme_audit
7) Use environment variables for DB URLs.
8) Standard REST response envelope:
   {
     status: "success|fail",
     message: string,
     data: any,
     error?: { code: string, details?: any }
   }
9) Add global validation pipe.
10) Add Swagger in each service at /docs.

Output:
- Full file tree
- All initial files
- No TODO placeholders
- Production-ready structure

Do not skip configuration files.