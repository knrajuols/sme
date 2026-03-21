
User your intelligence and your knowledge ( access to code base) also, while implementing this prompt.

Prompt Sequence: #261 (Porting Academic Governance & Master Data Provisioning)

1. Intelligence Command & Functional Requirement
We have successfully implemented the Academic Calendar and Holiday Management engines in the web-admin portal (operating under tenantId = 'MASTER_TEMPLATE').
Your objective now is to implement these exact same modules in the tenant-facing web-portal, reusing the existing UI components and backend services. Additionally, you must introduce a new provisioning feature: a "Generate from Master Data" button on both pages.

2. Analyze for Design, Implementation, and Testing across End-to-End Stack:

Navigation (web-portal): Add "Academic Calendar" and "Holiday Management" as sub-menus under the existing "Academics" Main Menu.

UI/UX Reusability: Do not rewrite the UI from scratch. Import or duplicate the highly refined page layouts, matrices, and grids we just built for web-admin.

New UI Element: Place a prominent "Generate from Master Data" button at the top of both the Academic Calendar and Holiday Management pages.

BFF / Backend Provisioning Logic: Create specific endpoints that fetch data where tenantId === 'MASTER_TEMPLATE' and clone it to the current user's tenantId.

3. Stack-Wide Execution (Definition of Done)

[ ] Navigation & Routing: >     * Implement routes /academics/academic-calendar and /academics/holidays in the web-portal.

[ ] "Generate from Master Data" - Academic Calendar:

Logic: When clicked, the backend must fetch all calendar records for the selected Academic Year from the MASTER_TEMPLATE tenant.

Action: Bulk Upsert these records into the current tenant's database. (Use date + tenantId + academicYearId to prevent duplicates).

[ ] "Generate from Master Data" - Holiday Management:

Logic: When clicked, the backend must fetch the WeekendConfig, HolidayMatrixRule, and HolidayEntry records from the MASTER_TEMPLATE tenant for the selected Academic Year.

Action: Clone these configurations and entries into the current tenant's database.

Safety: Ensure this cloning process never overwrites any local manual overrides (isManual: true) created by the school admin.

[ ] UI Feedback: >     * While generating, show a loading state on the button.

On success, display a Toast notification (e.g., "Successfully generated 45 holidays from Master Template") and automatically refresh the UI grids to show the new data.

[ ] BFF Integration: Ensure the web-portal BFF routes correctly map to the tenant-service cloning methods, strictly enforcing the current user's authenticated tenantId.

[ ] Compilation: Run tsc on both tenant-service and web-portal to ensure zero type or import errors.

4. Testing Verification

Test 1: Log into the web-portal as a school admin. Navigate to Academics -> Academic Calendar. The grid should be empty.

Test 2: Click "Generate from Master Data". Verify the grid populates with the CBSE dates created earlier in web-admin.

Test 3: Navigate to Holiday Management. Click "Generate from Master Data". Verify the Weekend Config, Matrix, and Preview List are instantly populated.

Enterprise Grade Code Mandate.
Design and Coding Standards: Maximum Code Reuse, Idempotency, and UI Responsiveness.

==============
Additional Note from User:

Analyze for Design, Implementation, and Testing across End-to-End Stack:
•	UI Pages
•	UI Elements
•	UI Must be Responsive
•	BFF
•	DTO
•	APIs
•	Gateways
•	Schema
•	Database
•	Services

Compile, fix errors, Build, Test end-to-end (UI to Database)

If you want you can stop or start services… Visual Studio Code is Started with Admin Permissions.

Design and Coding Standards Mandate at Enterprise Grade Level:
Reliability, Scalability, Security, UI.

Context Awareness: Do not guess file paths. Use your local index to find the correct Service, Controller, and Page files.