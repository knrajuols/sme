


PROMPT 1 — Monorepo scaffold (apps + libs + tooling)


You are GPT-5.3-Codex acting as a senior NestJS microservices architect. 

Goal: Scaffold a monorepo for "SME – School Management Excellence" at C:\projects\SME using NestJS + TypeScript. Use npm workspaces (not yarn). Create apps and libs folders. Create clean, production-grade structure.

Create the following NestJS apps (each its own service):
1) api-gateway
2) iam-service
3) tenant-service
4) config-service
5) audit-service

Create the following shared libs:
- libs/common (response envelope, error codes, pagination, correlation-id middleware, request context types, constants)
- libs/auth (JWT verify helper, guards, decorators, RBAC helpers)
- libs/messaging (RabbitMQ client wrapper, event envelope types, outbox publisher interfaces)
- libs/config-client (client to fetch tenant config + module enablement with Redis cache)
- libs/tenant-client (client to fetch tenant status with Redis cache)
- libs/db (typeorm/prisma setup helpers - choose Prisma)
- libs/logger (pino logger setup, correlation id binding)

Constraints:
- Use NestJS latest stable.
- Use Prisma for database access in each service (each service has its own Prisma schema and database).
- Use class-validator + class-transformer for DTO validation.
- Use Swagger for each service with /docs.
- Use pino logger.
- Provide standard REST response envelope:
  { status: "success|fail", message: string, data: any, error?: { code: string, details?: any } }

Generate:
- package.json (root) with npm workspaces configuration
- tsconfig base
- eslint + prettier config
- .editorconfig
- README.md explaining how to run everything
- docker-compose.yml for local dev: postgres instances (one per service), redis, rabbitmq, and all apps.

Output the full file tree and create all files with initial content. Do not omit any config files.