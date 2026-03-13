





Deliverables in the Report

Must-Fix Risk Log — 10 risks with exact file/line references and fix code

Finalized Schema 2.0 — Complete rewritten Prisma schemas for IAM, Audit, Config; targeted delta for Tenant

Hardened API Blueprint — RFC 7807 error catalogue, full endpoint inventory (IAM/Config/Audit/Academic), rate limiter spec, module guard spec, idempotency interceptor spec

Inter-Service Design — Transactional Outbox pattern, no-circular-dep auth handshake trace, Redis module cache flow, circuit breaker spec

DevOps — 3-phase zero-downtime migration protocol, Correlation ID propagation trace, observability stack requirements

Revisit List — 10 additional gaps beyond the original prompt (soft-delete ORM filters, version optimistic locking, GradeScale ownership, API versioning strategy, etc.)









We need to design and implement an enterprise-grade School Admin UI (web-admin) for SME.

Context:

* User has logged in as School Admin (Principal will use the same UI).
* We already have apps/web-admin (Next.js) with routes: /login, /dashboard, /academic/setup, /students, /attendance, /exams, /analytics.
* Backend is behind API Gateway at http://localhost:3000 and uses JWT.
* Architecture guardrails: ADR-002 strict tenant isolation, RBAC via permissions, portal is read-only.
* Goal now: Implement a consistent global admin layout + polished UX patterns (not full feature depth), so the app looks like a real enterprise product.

IMPORTANT RULES:

* Do NOT do repo-wide scanning or “read changed files list”. Only work in web-admin app and any shared UI package if it already exists.
* Keep changes incremental and predictable.
* Use TypeScript.
* Use Tailwind + existing component approach (if shadcn/ui is installed, use it; otherwise implement lightweight Tailwind components).
* Keep UI responsive and clean (desktop first, but works on smaller screens).
* Ensure all pages share a single layout.

========================================================
A) GLOBAL LAYOUT (ENTERPRISE SHELL)
===

Implement a global “AdminShell” layout for web-admin:

Top App Bar (sticky):

* Left: SME logo (simple text “SME”) + School Name (tenant label) + environment badge (DEV)
* Center: Global search box (placeholder “Search students, teachers, admissions…”; not fully functional yet)
* Right:

  * Notifications bell icon (dummy count badge)
  * Help icon (links to /help placeholder)
  * Profile avatar dropdown:

    * Profile
    * Settings
    * Logout

Left Sidebar (collapsible):

* Grouped navigation with icons and active state
* Collapsed mode shows icons only with tooltip
* Expand/collapse button at bottom
* Sidebar items (minimum set; some can route to placeholders if not implemented yet):

  1. Dashboard
  2. Academics

     * Academic Setup (year/class/section/subject)
     * Timetable

  3. People

     * Students
     * Teachers
     * Parents

  4. Operations

     * Attendance
     * Exams \& Results
     * Events / Calendar

  5. Insights

     * Analytics
     * Reports (placeholder)

  6. Administration

     * Roles \& Permissions (placeholder)
     * Audit Logs (placeholder)
     * Integrations (placeholder)

Main Content Area:

* Page header block:

  * Page title + short subtitle
  * Breadcrumbs (optional)
  * Right side primary action button (e.g., “Create Student”, “Create Exam”)

* Body content in cards with consistent spacing
* Bottom: subtle footer strip with version/build + copyright

Design language:

* Clean enterprise look
* Consistent typography (use default system font)
* Soft borders, rounded corners, subtle shadows
* Uniform spacing scale
* Dark mode optional later (do not implement now unless already present)

========================================================
B) STANDARD UI PATTERNS (REUSABLE COMPONENTS)
===

Create a small set of reusable components (within web-admin, or in a shared ui lib if exists):

1. PageHeader
   props: title, subtitle, actions (buttons), breadcrumbs?
2. DataTable (generic)

   * Column definitions
   * Row actions menu per row (kebab)
   * Supports:

     * Search (client-side for now)
     * Sort (client-side for now)
     * Pagination (client-side for now)
     * Empty state
     * Loading state

   * Row actions:

     * View
     * Edit (Any Edit will launch a pop-up window with elements of the row)
     * Deactivate / Activate

   * Use confirm modal for deactivate

3. Toolbar

   * Left: search input
   * Right: filters (dropdown placeholders) + “Create” button

4. Modal / Drawer (for create/edit forms)

   * Use a right-side drawer on desktop
   * Modal on small screens
   * Submit + Cancel buttons

5. Toast notifications for success/error
6. Status badges:

   * ACTIVE / INACTIVE
   * DRAFT / VERIFIED / PUBLISHED
   * PRESENT / ABSENT

========================================================
C) PAGES TO UPGRADE (VISIBLE IMPROVEMENTS)
===

Upgrade these pages to use AdminShell + components:

1. /dashboard

   * Summary cards: Students, Teachers, Attendance Today, Exams Pending Publish
   * Recent activity (placeholder list)
   * Quick actions buttons (Create Student, Mark Attendance, Create Exam)

2. /students

   * Table columns:

     * Admission No
     * Rool No
     * Student Name
     * Class
     * Section
     * Rank in the Latest Exam
     * Status (ACTIVE/INACTIVE)
     * CreatedAt
     * Actions menu (View/Edit/Deactivate)

   * Top “Create Student” button
   * Create Student drawer form (minimal fields):

     * admissionNumber
     * firstName
     * lastName
     * classId + sectionId (dropdowns loaded from academic setup)

   * On submit call existing API endpoints.
   * If APIs not ready for list, mock with placeholder but keep integration hooks.

3. /teachers

   * Add route and page (even if backend endpoints are limited now)
   * Table columns:

     * Employee/Staff ID (placeholder)
     * Teacher Name
     * Subject
     * Classes Teaching (If this field is not present in Schema, we need to add this, and enable CRUD wherever applicable)
     * Date of Joining
     * Phone/Email
     * Status
     * Actions

   * Create Teacher drawer form (minimal)

4. /parents

   * Add route and page
   * Table columns:

     * Parent Name
     * Phone/Email
     * Linked Students count
     * Status
     * Actions

5. /exams

   * Table columns:

     * Exam Name
     * Class
     * Academic Year
     * Status (DRAFT/VERIFIED/PUBLISHED)
     * Actions (View/Edit/Verify/Publish)

   * Primary button “Create Exam”
   * Publish action should call publish endpoint and show toast

6. /attendance

   * Simple date selector
   * Sessions list table
   * “Create Session” button

7. /analytics

   * Exam selector dropdown
   * Rankings table
   * Class summary cards
   * Correlation highlight

For routes not fully implemented backend-wise, create UI skeleton with “Coming Soon” but keep the navigation and layout consistent.

========================================================
D) AUTH + TENANT CONTEXT DISPLAY
===

In AdminShell:

* Show school/tenant label in the top-left.
* Source it from the JWT claim or from a /me endpoint (whichever already exists).
* Show role badges (SCHOOL\_ADMIN, TEACHER).
* Ensure Logout clears token and redirects to /login.

========================================================
E) ACCESS CONTROL IN UI (LIGHTWEIGHT)
===

Implement a simple permission check helper:

* If user lacks permission for a page action, disable the button and show tooltip “Not permitted”.
* Do not rely solely on UI for security (backend already enforces).

========================================================
F) IMPLEMENTATION APPROACH
===

1. Implement AdminShell + navigation + header first.
2. Migrate existing pages to the layout.
3. Add Students table + create drawer as reference pattern.
4. Add Teachers + Parents pages using same pattern.
5. Add consistent styling and toast feedback.

========================================================
G) VALIDATION
===

After implementation:

* npm run build (must PASS)
* npm run dev:web-admin
* Confirm:

  * login works
  * dashboard renders with new layout
  * sidebar nav works
  * students page table renders
  * create drawer opens/closes
  * profile dropdown shows logout
    Ask for Allow before running any commands.

At the end, provide a concise summary:

* new components added
* pages upgraded
* routes added
* what is mocked vs integrated
