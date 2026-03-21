
Prompt Sequence: #252 (High-Performance Attendance: Integrated Event-Blob Model)

1. Intelligence Command & Functional Requirement
Use your intelligence ALSO (use your domain knowledge also) to implement a high-performance Daily Attendance system. We are adopting a "One-Row-Per-Class-Per-Day" strategy using an Event-Blob (TEXT) to store attendance data. This minimizes database I/O and provides the efficiency of a memory map while allowing for complex data like Teacher Swipe-In/Out times.

2. Analyze for Design, Implementation, and Testing across End-to-End Stack:

UI Pages: Daily Attendance Entry Grid (Separate tabs or sections for Students and Teachers).

UI Elements: A high-speed toggle grid. Students: P/A/L/E. Teachers: P/A/L + Swipe-In/Out Time Pickers.

BFF: Serialization logic that converts the UI grid into a JSON string for storage, and vice versa for retrieval.

DTO: AttendanceSubmissionDto and AttendanceLogResponseDto.

APIs: Attendance Controller for Save/Fetch operations.

Gateways: Route registration for /operations/attendance.

Schema: Create/Update the AttendanceLog table:

id (UUID, PK)

date (DATE)

classSectionId (UUID, FK) - Nullable for standalone Staff attendance.

attendanceBlob (TEXT) - Stores the JSON string of statuses and timestamps.

status (INT) - 0: Draft, 1: Locked.

Services: Logic to map individual Student/Teacher IDs to keys within the JSON blob.

3. Stack-Wide Execution (Definition of Done)

[ ] Schema: Implement the AttendanceLog model with the TEXT blob field.

[ ] UI (Entry Grid): Load all students for a Section. Provide a "Mark All Present" shortcut. Toggle between A/P/L. For Teachers, provide inputs for "Swipe In" and "Swipe Out" times.

[ ] Logic (The Blob): On Save, the system must generate a JSON string (e.g., {"S1":"P", "T1":["P","08:30","17:00"]}) and store it in the single attendanceBlob field.

[ ] UI (Locking): Implement a "Lock Attendance" button that sets status = 1 and makes the grid read-only to prevent tampering.

[ ] State Persistence: Ensure the selected Date, Class, and Section are retained in the UI after a page refresh.

[ ] Compilation: Run tsc on both the portal and the service.

4. Testing Verification

Test 1: Save attendance for a class of 40. Verify in the database that exactly one row is created with the full JSON blob.

Test 2: Verify that teacher timestamps are accurately saved and re-hydrated into the time-pickers upon page reload.

Test 3: Verify that "Appeared" vs "Absent" counts in the Analytics dashboard can correctly parse this blob.

Enterprise Grade Code Mandate.
-------------------
Compile, fix errors, Build, Test end-to-end (UI to Database)
================
If you want you can stop or start services… Visual Studio Code is Started with Admin Permissions.
============
Design and Coding Standards Mandate at Enterprise Grade Level:
Reliability, Scalability, Security, UI.

Context Awareness: Do not guess file paths. Use your local index to find the correct Service, Controller, and Page files.

------------------
