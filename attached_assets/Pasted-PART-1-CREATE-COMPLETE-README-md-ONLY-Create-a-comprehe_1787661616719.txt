PART 1 — CREATE COMPLETE README.md ONLY

Create a comprehensive `README.md` file in the project root for this Ledger Accounting Software.

IMPORTANT:
This task is ONLY to create/update `README.md`.

Do NOT:
- modify application code
- modify UI
- modify calculations
- modify database
- modify migrations
- modify API behavior
- delete or rename any files
- remove Replit branding
- replace any agency name
- install dependencies
- start Preview
- start development servers
- run builds
- run migrations
- perform any setup or deployment work

Use the EXISTING CODEBASE as the only source of truth. Inspect the existing files/code as needed to document the project accurately. Do not invent features or behavior.

The README must be a complete A-to-Z technical handover for any future human developer or AI developer.

Include, where confirmed by the codebase:

1. Project overview and purpose
2. Technology stack and exact versions
3. Project structure and important folders/files
4. Frontend architecture
5. Backend/API architecture
6. SQLite database technology, configuration and exact data location
7. Database tables, important columns and relationships
8. Database connection and initialization
9. Database migration system
10. Exact process for creating and applying future migrations safely
11. How to preserve existing client data during software updates
12. Backup and Restore system
13. Data storage and offline behavior
14. Environment variables and configuration
15. All major modules and where their code is located
16. API routes/endpoints and their purpose
17. Frontend pages/components and their locations
18. Dashboard and date-filter behavior
19. Partner investments
20. Partner direct expenses
21. Petty cash given
22. Accountant expenses
23. Joint Company Income
24. Final Summary & Settlement
25. Partner share percentages and settlement calculations
26. Core accounting calculations and exactly where they are implemented
27. Excel/CSV import and export behavior
28. Reports
29. Development/run commands
30. Build commands
31. API specification/code-generation workflow
32. How to safely add a new feature
33. How to safely modify an existing feature
34. How to safely modify the database/schema in the future
35. Required backup procedure before migrations or major updates
36. Future Windows EXE packaging considerations
37. Important dependencies
38. Known warnings, limitations and gotchas
39. Troubleshooting information that can be confirmed from the codebase
40. Any other information a developer needs to maintain, update and extend this software safely

For every important item, include the actual file/folder path where the relevant implementation exists.

For database migrations, clearly explain:
- where migrations are located
- how migration versions are tracked
- how migrations run
- how to create a new migration
- how to ensure existing client data is preserved
- what must never be done to the production/client database

For calculations and accounting logic, document the ACTUAL implementation found in the codebase. Do not guess or create new formulas.

For anything that cannot be confirmed from the repository, explicitly write:
"Not confirmed by the current codebase."

Keep the README professional, structured and easy for an external developer to understand.

Do not create any additional documentation files.
Do not change anything except creating/updating `README.md`.

After completing the task, report only:
- README.md created/updated
- the main sections documented
- anything important that could not be confirmed from the existing codebase

Do not perform Preview, build, deployment or other setup work.