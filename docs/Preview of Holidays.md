My note to Gemini as listed below:


Holiday Management is looking progressing well.

I have following observations from my testing.
--------------
In the
Weekend Holidays Configuration,
When I Ticked Sunday (Full Day),

I expected, all Sunday in Monthly Matrix will be marked Holiday.
That automatic triggering is not happening.

So, I have to manually Tick All Sundays in the Monthly Matrix Holiday.
-------------
It should be automatic filling.
------------------
Second Observation:
When I clicked 
Preview Holidays Button

It is telling 
Preview - 0 holidays entries.

So, it is blindly showing the holidays entered in the
Holiday Entries 
Section 
(Last Section in the Page)

We are expecting Preview to show the complete picture of Holidays for the total Academic Year, in the format:

Columns: Academic Year, Date, Occasion, Type (Holiday, Vacation), Full/Half, Remarks.

So that we know the full picture of what we are going to generate (holidays)
-----------------
One more observation:

Last Section, 
Holiday Entries
It is asking to Add Holiday

But, we may not know what all are the Holidays, configured in Academic Calendar.

So, this section has to show the full table of Holidays, pulled from Academic Calendar, so that User knows if he has to add any more.
-------------------
Give me prompt, clearly listing these gaps and requirements...
While listing the gaps and listing the requirement, don't be brief... make it clear detailed.
-----------------
Think anything else is missing and create Prompt
-------------------
My note to Gemini Ends here.
=======================================

Here is Prompt from Gemini

Copy and paste this to Opus 4.6 3x:

Prompt Sequence: #260 (The Holiday Engine: Deep Integration & Simulation Logic)

1.	Intelligence Command & Functional Requirement I am identifying three significant logical gaps in the current Holiday Engine implementation that prevent it from being "Enterprise Grade." You must re-engineer the flow to ensure that user configurations trigger automatic UI updates and that the "Preview" acts as a high-fidelity simulator before database commitment.

2. Gap Analysis & Required Remediation:
•	Gap 1: Reactive Configuration Sync (Weekend → Matrix)
o	Current Issue: Toggling "Sunday" in the Weekend configuration does not reflect in the Monthly Matrix.
o	Requirement: Implement a State Observer. When a Full Day or Half Day is marked as a  Holiday in the Weekend Holidays Configuration, the UI must automatically "check" all 1st through 5th occurrences of that day in the Monthly Holiday Matrix and disable those specific checkboxes to prevent conflicting configurations.
o	Logic: If Sunday is a global weekend, it is by definition a 1st-5th Sunday holiday.

•	Gap 2: The Simulation Engine (The "Preview" Logic)
o	Current Issue: The Preview button is only showing existing database records (returning 0 for new setups).
o	Requirement: The "Preview Holidays" button must trigger a Dry-Run of the Generation Engine. It must:
1.	Parse the Academic Calendar (CSV/Master data) for Vacations and Holidays.
2.	Apply the Weekend Configuration patterns.
3.	Apply the Monthly Matrix rules.
4.	Generate a temporary list in memory and return it to the UI in the specified table format: Academic Year, Date (DD-Mon-YYYY), Day, Occasion, Type (Holiday/Vacation/Weekend), Session (Full/Half), and Remarks.
o	User Value: The user must see the entire year's plan before they click "Generate & Save."

•	Gap 3: Reference Awareness in Manual CRUD
o	Current Issue: The "Holiday Entries" list is empty or disconnected from the "Academic Calendar" context.
o	Requirement: The final section must be a Merged View. Even before generation, it should optionally show "Referenced Holidays from Academic Calendar" (perhaps in a distinct color or with an 'Unsaved' badge) so the admin knows exactly which manual holidays are truly "additional."
	
3. Technical Mandate (Stack-Wide):
•	Frontend (web-admin): Implement useEffect hooks or state management to sync the Weekend and Matrix grids.
•	BFF/Service: Ensure the generateHolidays method has a preview: boolean flag. When true, it must return the array of objects without calling prisma.holidayEntry.upsert.
•	Date Formatting: Use date-fns to ensure the Date column in the preview and list displays as 15-Mar-2026 for high readability.
•	Idempotency: Re-verify that "Generate & Save" uses an Upsert logic based on [date, tenantId] to ensure manual remarks or "Declared Holidays" are never deleted.

4. Definition of Done:
•	[ ] Toggling a weekend day auto-populates and locks the corresponding Matrix rows.
•	[] The last Section, Holiday Entries show all holidays from Academic Calendar so that User knows clearly, if anything else to be added.
•	[ ] "Preview" displays a full list (e.g., ~60-80 rows for a standard year) Holidays listed in Academic Calendar, Weekend Configuration, Monthly Matrix and any Holidays Entered from this page.
•	[ ] The "Holiday Entries" table accurately displays the source (Source: Calendar vs. Source: Matrix).
•	[] In the Monthly Matrix, we should add a "Clear Matrix" button. If the Admin makes a mistake while clicking through 35 checkboxes (7 days x 5 occurrences), they need a quick way to reset the matrix to the default state (based on the Weekend config) without refreshing the whole page and losing their other work.

•	[ ] All services compile with zero errors.

Enterprise Grade Code Mandate. Design for Reliability and UI Intuition.
