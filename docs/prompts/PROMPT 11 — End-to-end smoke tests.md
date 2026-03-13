

PROMPT 11 — End-to-end smoke tests

Add an end-to-end local smoke test script at root (node ts script) that:
1) brings up docker compose
2) creates tenant via tenant-service platform endpoint
3) logs in as created tenant admin
4) calls config modules and enables/disables one module
5) checks gateway blocks disabled module route
6) verifies audit logs created for key actions (login, tenant created, module toggle)

Implement as npm script: npm run smoke:test
Document in README.