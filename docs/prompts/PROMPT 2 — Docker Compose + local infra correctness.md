
PROMPT 2 — Docker Compose + local infra correctness


Review and finalize docker-compose.yml for local development.

Requirements:
- rabbitmq with management UI exposed
- redis exposed
- Postgres: create separate databases for each service OR separate containers. Prefer separate databases in one Postgres container to reduce complexity, but enforce db-per-service logically via unique DB names and unique Prisma connections. 
- Provide .env.example at root and for each service app (apps/<service>/.env.example) with:
  - PORT
  - DATABASE_URL
  - REDIS_URL
  - RABBITMQ_URL
  - JWT_PUBLIC_KEY / JWT_PRIVATE_KEY (for local)
  - SERVICE_NAME

Add docker compose health checks and service dependencies.

Add make-like npm scripts in root for:
- dev:up (docker compose up -d)
- dev:down
- dev:logs
- dev:migrate (runs prisma migrate for all services)
- dev:seed (optional placeholders)

Update README accordingly.

Implement everything in the repo. Show diffs or file contents where you changed.