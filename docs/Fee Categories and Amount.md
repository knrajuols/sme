

Prompt Sequence: #256 (Master Data: Fee Governance & Structural Mapping)

REQUIREMENT: Implement the Fee Management module within the Master Data section of web-admin (not web-portal), so that new tenants can Generate Fee Module from this Master Module.

This module is the financial foundation of the platform and must be architected for high precision and multi-tenant scalability.

Note: Use your intelligence and domain knowledge ALSO, while implementing.  

===============
Section 1: Fee Categories
(The "What"): 
Manage the types of fees:

Admission Fees:
Annual Fees:
Tuition Fees:
Utilities Fees:
==============
Section 2: Fee Structures 
(The "Who & How Much"): 
ENSURE that Fee Categories are definable to Each Class and in an Academic Year.
(Which means we should be able to define Fee Structure for each Class in an Academic Year)
---------------
2A. Admission Fees (Admission Phase):

Registration Fee: (Non-refundable) ₹500 
Admission Fee: ₹5,000 (Varies heavily by city).
Security Deposit/Caution Deposit: (Refundable) ₹5,000
-------------
2B: Annual Fees (Academic Year Start)

Infrastructure/Development Fee: ₹2,000 
Examination Fee: ₹1,000
Lab/Library Fee: ₹1,000
Student Insurance & Diary: ₹500
---------------
2C: Tuition Fees (Recurring) (Quarterly)

Pre-Primary (Nursery - UKG): ₹2,500 
Primary (Class 1 - 5): ₹3,500 
Middle School (Class 6 - 8): ₹4,500 
Secondary (Class 9 - 10): ₹5,500 
Sr. Secondary (Class 11 - 12): ₹6,500
--------------
2D: Utilities Fees:
Transport Fee: 
Based on distance (Slabs: 0-2km, 2-4km, 4-6km, 6-8km, 8-10km).

=================
3. Analyze for Design, Implementation, and Testing across End-to-End Stack:

3A: UI Pages:

***UI Pages are available (in web-portal) for both Fee Categories and Fee Structures****

*IF needed, make changes to existing UI in web-portal.*
Use the revised UI pages / forms in web-admin for creating Master Management.
-----------
3B: Fee Categories Management (List & "New Categories" Form and CRUD).

3C: Fee Structures Management (List & "New Fee Structure" Form and CRUD).

3D: BFF: Endpoints to manage Categories and generate the class-wise structures.

3E: DTO

3F: API

3G: Gateway 

3I: Schema (Prisma/DB):

******IMP: CHECK THE EXISTING SCHEMA and MAKE CHANGES ACCORDINGLY**********

3J: Database: Ensure decimal precision for the amount field to avoid rounding errors.
================

4. Stack-Wide Execution (Definition of Done)

4A: Fee Categories (CRUD): Review the existing page and form, in web-portal and make changes if needed - CRUD Support.
(use existing/revised form in web-admin)

4B Fee Structure Form:  Review the existing page and form, in web-portal and make changes if needed - CRUD Support.
(use existing/revised form in web-admin)

Following are the Fields Available in Fee Structure (in the current form):

Academic Year (Dropdown)
Class (Dropdown)
Fee Category (Dropdown - linked to Categories)
Amount (₹) (Number Input) (Make this OPTIONAL at this stage)
Due Date (Date Picker) (Make this OPTIONAL at this stage)

4C: Validation: Ensure that the same Fee Category cannot be assigned to the same Class/Year twice (Prevent duplicates).

4D: UI List View: Create a "Master Fee Schedule" table that allows admins to filter fee structures by Academic Year and Class to see a total projected fee for a student in that class.

[ ] Compilation: Run tsc on both the portal and service.

==============
5 - In web-portal UI, 
Provide a Button called, Generate from Master Data, in both 
Fee Categories
Fee Structures 
Pages

Once we used it / clicked it, diable it.
Enable it only when there are no entries available.
===============
6. In web-admin UI 
Fee Categories
Fee Structures 
should support CRUD
-----------
7. In web-portal UI
Fee Categories
Fee Structures 
should support CRUD

==============
8. Testing Verification - end-to-end (UI up to Backed)

9. Enterprise Grade Code Mandate.

10.
Compile, fix errors, Build, Test end-to-end (UI to Database).

If you want you can stop or start services… Visual Studio Code is Started with Admin Permissions.

Design and Coding Standards Mandate at Enterprise Grade Level:
Reliability, Scalability, Security, UI.

Context Awareness: Do not guess file paths. Use your local index to find the correct Service, Controller, and Page files.
