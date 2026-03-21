Implement the following:
(Apply your intelligence also wrt domain knowledge and considering code structure)

In web-admin  (not web-portal)
(For your reference: Currently web-admin is available at sme.test:3101)

UI
Under Master Data Menu
Add sub-menu item called Grading System

This should be stored under 
Tenant = MASTER_TEMPLATE

CRUD should enabled.

Grade	Min (%)	Max %	Grade Point	Performance Indicator
A1	91	100	10.0	Outstanding
A2	81	90	9.0	Excellent
B1	71	90	8.0	Very Good
B2	61	70	7.0	Good
C1	51	60	6.0	Above Average
C2	41	50	5.0	Average
D	33	40	4.0	Fair (Pass)
E (Needs Improvement)	0	32	0.0	Needs Improvement / Fail

2. Analyze for Design, Implementation, and Testing across End-to-End Stack:
•	UI Pages 
•	UI Elements 
•	BFF 
•	DTO 
•	APIs
•	Gateways
•	Schema 
•	Database
•	Services 
-------------------
Compile, fix errors, Build, Test end-to-end (UI to Database)
================
If you want you can stop or start services… Visual Studio Code is Started with Admin Permissions.
==================================

Summary Report
What was implemented
CBSE Grading System — full CRUD feature from UI to Database, stored under MASTER_TEMPLATE tenant in web-admin.

Files Modified (4 files)
File	Change
schema.prisma:973	Added gradePoint (Float) and performanceIndicator (String) to GradeScale model
create-grade-scale.dto.ts	Added gradePoint and performanceIndicator with validation
update-grade-scale.dto.ts	Added optional gradePoint and performanceIndicator
academic.service.ts:2237	Updated create/list/update methods to handle new fields
web-admin.controller.ts	Added 5 CRUD endpoints at /web-admin/grading-system
Navbar.tsx	Added "Grading System" link under Master Data menu
Files Created (3 files)
File	Purpose
grading-system/route.ts	BFF: GET (list) + POST (create)
grading-system/[id]/route.ts	BFF: PATCH (update) + DELETE (soft-delete)
grading-system/page.tsx	Full CRUD UI with table, slide-over panel, delete dialog, and CBSE seed button
Data Flow

UI Page → bffFetch('/api/web-admin/grading-system')   → BFF Route (Next.js API) → fetch('http://localhost:3002/web-admin/grading-system')    → WebAdminController (tenantId=MASTER_TEMPLATE) → AcademicService → Prisma → PostgreSQL
Key Features
CBSE Grading Scale: 8-grade system (A1→E) with grade points and performance indicators
Seed Button: One-click population of all CBSE grades when table is empty
Responsive: Desktop table + mobile card layout
Security: Requires PLATFORM_ADMIN role + TENANT_CREATE permission
Enterprise patterns: Soft delete, audit trails, correlation IDs, error codes
Verified
TypeScript: zero compilation errors (both tenant-service and web-admin)
Database: schema pushed to PostgreSQL successfully
Tenant-service: all 5 routes registered and responding (401 without auth = correct)
Web-admin: grading system page loads at http://sme.test:3101/master-data/grading-system
Claude Opus 4.6 • 3x
