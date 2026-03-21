

Prompt Sequence: #254 (Attendance Governance & Multi-Period Analytical Reporting)

1. Intelligence Command & Functional Requirement
Use your intelligence and domain knowledge ALSO, to finalize the Attendance Governance model. We are moving from simple tracking to a formal analytical reporting structure. The system must capture daily status via the "Event-Blob" and aggregate it into a high-fidelity "Review Report" across various academic periods.

2. Enhancements to Attendance module, and Testing across End-to-End Stack:



UI Elements: >  From existing elements (Daily Grid: Status Positions) like P, A, L, E,
Moving to revised elements

P, OD, SL, CL, HL, A

Help text for the buttons are: P (Present), OD (On Duty), SL (Sick Leave), CL (Casual Leave), HL (Half-Day), A (Absent)

Above elements are applicable to both Students and Teachers.

Review Filters for Reports: Selection for Monthly (Single Month), Quarterly (3-month range), Half-Yearly (6-month range), and Yearly (Full Academic Year range).

BFF/Service: Aggregation engine that parses JSON blobs across the selected date range.

Schema/DB: Maintain the AttendanceLog (Event-Blob) structure. Ensure the Teacher "Swipe-In" is auto-captured as the current server time upon marking 'P'.

3. Stack-Wide Execution (Definition of Done)

[ ] Locking UX: When status === 1 (Locked), change the button label to "Attendance Locked", disable it, and hide the "Save" and "Mark All Present" buttons to prevent UI clutter.

[ ] Status Update: Update the Daily Grid and JSON logic to include OD (On Duty) and remove E.

[ ] The Review Report (Grid): Build a comprehensive report table with the following columns:

Academic Year | Class | Section | Roll No | Student Name | Total Working Days | P | OD | SL | CL | HL | A | Attendance %.

[ ] Logic (Working Days): Total Working Days must count the number of AttendanceLog entries (Locked days) within the selected date range for that Section.
(for now assume Sunday is holiday... when we enter holidays in the Calendar, we will consider holidays in calculating working days)


[ ] Logic (Aggregation): Calculate the sum of each status per student by scanning the blobs in the selected range.

[ ] UI (Review Logic): >     * Monthly: User selects a month (e.g., July).

Quarterly/Half-Yearly: User selects start and end months (validated to 3 or 6 months).

Yearly: Pulls from the start and end dates of the active Academic Year.

[ ] Persistence: Ensure all filters (Date, Class, Section, Review Type) are retained on refresh.

[ ] Compilation: Run tsc on both the portal and service.

4. Testing Verification

Test 1: Verify the Daily Grid shows the new OD status.

Test 2: Generate a Monthly Report for Class 10A and verify that P + OD + SL + CL + HL + A equals the Total Working Days.

Test 3: Verify that the Yearly filter correctly bounds the data to the current Academic Year's dates.

Enterprise Grade Code Mandate.

-----------------------
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
============
Design and Coding Standards Mandate at Enterprise Grade Level:
Reliability, Scalability, Security, UI.

Context Awareness: Do not guess file paths. Use your local index to find the correct Service, Controller, and Page files.

------------------
