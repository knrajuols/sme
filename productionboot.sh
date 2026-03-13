#!/bin/bash
# ==============================================================================
# SME PLATFORM: PRODUCTION ZERO-TOUCH DEPLOYMENT
# ==============================================================================
set -e # Strict mode: Abort immediately on any error

echo "===================================================="
echo "   STARTING PRODUCTION DEPLOYMENT SEQUENCE"
echo "===================================================="

# 1. ENVIRONMENT INJECTION (Production Standard)
# In production, we load a single, heavily secured .env file located on the server
echo "[1/4] Loading secure environment variables..."
if [ -f "/etc/sme/production.env" ]; then
    export $(grep -v '^#' /etc/sme/production.env | xargs)
else
    echo "CRITICAL: Production environment file missing. Aborting."
    exit 1
fi

# 2. INFRASTRUCTURE SPIN-UP
echo "[2/4] Booting Docker Infrastructure (Postgres, Redis, RabbitMQ)..."
docker compose -f docker-compose.prod.yml up -d

# --- THE PRODUCTION INTELLIGENCE: WAITING FOR THE DB HEARTBEAT ---
echo "--> Waiting for PostgreSQL to initialize..."
RETRIES=15
until docker exec sme-postgres pg_isready -U postgres > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
  echo "Waiting for database server... ($RETRIES attempts left)"
  sleep 2
  ((RETRIES--))
done

if [ $RETRIES -eq 0 ]; then
  echo "CRITICAL: Database failed to initialize in time. Aborting deployment."
  exit 1
fi
echo "--> PostgreSQL is awake and accepting connections."

# 3. SCHEMA DEPLOYMENT (The Headless Standard)
echo "[3/4] Deploying Version-Controlled SQL Migrations..."
# We use 'migrate deploy'. It checks the _prisma_migrations table and only applies missing files.
npx prisma migrate deploy --schema=apps/tenant-service/prisma/schema.prisma
npx prisma generate --schema=apps/tenant-service/prisma/schema.prisma

# 4. MICROSERVICE BOOT (PM2 or Docker)
echo "[4/4] Launching SME Microservices..."
# In production, we don't use 'npm run'. We use a process manager like PM2 to keep it alive forever.
pm2 start apps/tenant-service/dist/main.js --name "sme-tenant-api"
pm2 start apps/academic-service/dist/main.js --name "sme-academic-api"
pm2 save

echo "===================================================="
echo "   PRODUCTION PLATFORM IS LIVE"
echo "===================================================="