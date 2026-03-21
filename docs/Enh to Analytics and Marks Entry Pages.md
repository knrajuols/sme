Implement the following:
(Apply your intelligence also wrt domain knowledge and considering code structure)
----------------

Prompt Sequence: #250 (Integrated Exam Attendance & Dynamic Analytics)

1. Intelligence Command & Functional Requirement
This is my prompt. Use your intelligence ALSO, to perform a full-stack audit and implementation of an integrated Exam-Attendance and Marks-Analytics system. The goal is to unify "Exam Day Status" with "Mark Entry" while enabling deep, data-driven insights in the Analytics dashboard. Apply your architectural reasoning to ensure all components are decoupled but synchronized.

2. Analyze for Design, Implementation, and Testing across End-to-End Stack:

UI Pages (Mark Entry & Analytics)

UI Elements (Locking Mechanisms, High-Fidelity Tables, State Persistence)

BFF (Dynamic Aggregators & Lock-Status Management)

DTO (Statistical Response Objects with Rank Counts)

APIs

Gateways

Schema (Attendance Lock state on Exam-Section level)

Database (SQL Aggregation for Distinct Ranks)

Services (Mapping student scores to the new Grading System)

3. Stack-Wide Execution (Definition of Done)

[ ] Mark Entry (Attendance & Locking):

Use existing "Absent" checkbox per student (Default: Unchecked).

Implement a "Lock Attendance" button. Once locked, checkboxes must be disabled and the state persisted in the DB to prevent tampering.

[ ] Analytics (Dynamic Podium & Grade Distribution):

Unique Ranks: Identify the 1st, 2nd, and 3rd Distinct highest scores.

Student Counts: Add a "Count" column next to each Rank (e.g., 1st Highest | Count).

Grade Mapping: Use the Grading System created in the master data to calculate Grade distribution (e.g., "How many students got A+?"  cover all grades, for each subject).

Pass %: Calculate the Pass Rate dynamically by identifying the "Minimum Pass Grade" defined in the Master Data Grading System.

[ ] UI (Persistence & UX):

Implement State Persistence (URL or LocalStorage) so refreshing retains Exam, Class, and Section selections.

Ensure Averages are calculated based only on "Appeared" students.

[ ] DevOps (Process Recovery):

Provide/Execute a utility command to kill ghosting node.exe processes to resolve "Access Denied" errors during deployment.

[ ] Compilation: Run tsc on both modules to ensure zero type errors.

4. Testing Verification

Test 1: Lock attendance for Section A and verify the "Absent" fields become read-only.

Test 2: Verify Analytics table shows the correct count of students for each unique top-3 rank.

Test 3: Verify "Pass %" updates correctly if the Grading System's pass-threshold is changed.

Enterprise Grade Code Mandate.

------------------

Analyze for Design, Implementation, and Testing across End-to-End Stack:
•	UI Pages 
•	UI Elements 
•	UI Must be Reponsive
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
============
Design and Coding Standards Mandate at Enterprise Grade Level:
Reliability, Scalability, Security, UI.

Context Awareness: Do not guess file paths. Use your local index to find the correct Service, Controller, and Page files.

------------------

