

Strictly No Data Loss

Prompt Sequence: #300 (SaaS Architecture - Granular Master Seeding & Tenant Cloning)

1. Intelligence Command & Objective

We are implementing our "Master Template" pattern using a strict separation of concerns. The Super Admin (web-admin) manages the Master Data, and the School Tenant (web-portal) clones it. 

I have attached Dept Groups v2.csv containing our highly granular Enterprise Department and Role structure. Use this CSV as the absolute source of truth to update the schema, build the Super Admin seeding function, and build the Tenant cloning flow.

2. Phase 1: Database Schema (tenant-service)

Read the attached CSV's System Category Enum column.

Update the SystemRoleCategory Enum in schema.prisma to match these ~40 unique categories exactly. Create and apply the database migration.

3. Phase 2: Master Seeding via web-admin 

Backend Endpoint: Create a web-admin endpoint. This endpoint must parse the attached CSV data (you may hardcode the JSON array equivalent into the service to avoid file uploads).

Action: >   1. First, extract the unique Department Names and upsert them into the Department table. CRITICAL: Save these with tenantId: 'MASTER_TEMPLATE'.

2. Next, iterate through the rows to upsert the Specific Roles into the EmployeeRole table. Link each role to its corresponding Master Department ID, map the System Category Enum to the systemCategory field, and strictly save these with tenantId: 'MASTER_TEMPLATE'.

Web-Admin UI: Create a sub-menu item under Master Data  Add a "Seed Master Org Structure" button that calls this endpoint.

4. Phase 3: Tenant Cloning via Web-Portal (tenant-service & web-portal)


Backend Endpoint: Create a Tenant endpoint: 

Fetch all Departments and Roles belonging to MASTER_TEMPLATE.

Safely insert the Departments into the requesting user's specific tenantId.

Then, safely insert the Roles into the user's tenantId, ensuring they link to the newly created local Department IDs (not the Master IDs).

This endpoint must be idempotent (do not duplicate if a department/role with the same name already exists locally).

Web-Portal UI: In the web-portal app, navigate to the Tenant's Department/Roles Settings page (e.g., /settings/departments).

Action Button: Add a "Generate from Master Data" button. When clicked, it calls the clone-master endpoint, shows a success toast, and refreshes the tenant's local department/role lists.

5. Definition of Done

Prisma Enum strictly matches the 40+ CSV values.

web-admin can seed the complete Department + Role hierarchy into MASTER_TEMPLATE.

web-portal can click "Generate from Master Data" to clone the entire hierarchy into their own workspace seamlessly.

