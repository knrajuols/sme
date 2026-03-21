This is in continuation of Academic Calendar feature we implemented.
Once Academic Calendar is available, the next requirement is to generate holidays list (day-wise marking).
Holiday list is needed for Attendance Module for showing appropriate buttons (P, OD, SL, CL, HL, L and HD) for a given days.
If a given day is a Holiday, automatically other buttons will be deactivated.


Prompt Sequence: #258-B (The Universal Holiday & Weekend Engine)

1. Intelligence Command & Functional Requirement
Use your intelligence and domain knowledge ALOS,  to implement the Holiday Engine. This is a critical prerequisite for the Attendance Module, which will consume this data to determine if attendance is "Demanded" (P/A/L/E) or "Excused" (HD/HF)(HF means Half-Holiday).

2. Analyze for Design, Implementation, and Testing across End-to-End Stack:

UI Pages: Holiday Management under Master Data.

UI Elements: "Generate Holidays" Button, a Weekend Holidays Configuration Modal, and a Monthly Holiday Matrix.

BFF/Service: Logic to expand Academic Calendar dates and apply recurring weekend/half-day patterns.

Schema/DB: >    add / modify Schema items as required.

3. Stack-Wide Execution (Definition of Done)

[3A ] Weekend Holidays Configuration Modal:

Provide a row with checkboxes: [Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun].

Allow the Admin to mark specific days as recurring weekend holidays (e.g., Sun).

The days selected here will go in to Final Holiday list.


[3B ] Monthly Holiday Matrix (The "Nth Day" Policy):

For each day of the week, provide configuration for occurrences (1st, 2nd, 3rd, 4th, 5th).

Each occurrence must have two slots: [First Half] [Second Half].

Use Case: This allows an Admin to set "2nd and 4th Saturday - Full Holiday" and "All other Saturdays - Second Half Holiday."

[ 3C] The Generation Engine (Logic):

Range Expansion: Parse "Vacation Start" to "Vacation End" from the Academic Calendar and create individual date records.

Pattern Application: Loop through the Academic Year dates and apply the Weekend + Monthly Matrix policies.

Idempotency (Upsert): Only overwrite system-generated dates. Do not delete or overwrite records where isManual: true (manually declared holidays like "Rainy Day").

[3D ] UI Preview & CRUD:

Display a Responsive PREVIEW List before final DB commit.

Columns: Academic Year, Date, Occasion, Type (Holiday, Vacation), Full/Half, Remarks.

Enable full CRUD for individual holiday adjustments post-generation.

[ ] Compilation: Run tsc on both tenant-service and web-portal.

4. Testing Verification

Test 1: Configure "Sunday - Full" and "2nd Saturday - Full". Verify the engine generates exactly those dates for the whole year.

Test 2: Configure "Every Friday - Second Half Holiday". Verify the generated list shows Fridays as Half-Holidays.

Test 3: Verify that the Attendance Module can query this table to decide whether to show the "H" status button for a given date.
-------------
Enterprise Grade Code Mandate.
Design and Coding Standards: Reliability, Scalability, UI Responsiveness.
---------------------

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



