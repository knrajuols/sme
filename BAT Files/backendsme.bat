@echo off
powershell -Command "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -NoExit -Command cd C:\projects\SME; taskkill /F /IM node.exe /T 2>$null; taskkill /F /IM prisma.exe /T 2>$null; npx prisma generate --schema=apps/tenant-service/prisma/schema.prisma; npm run smeapplocal' -Verb RunAs"
exit