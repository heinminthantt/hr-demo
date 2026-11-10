# HR Admin (Myanmar payroll)

Next.js (shadcn monorepo) + Supabase. Modules: Overview, Employees, Attendance, Forms (leave), Team Tasks, Payroll, Payslips, Reports, Recruitment, Fuel & Vehicles, Expense Claims, Gmail Automation, Settings.

Every module has analytics, and the core records open into dedicated drill-down pages:

- **Employees** -> profile with overview, attendance, leave, payroll, documents and activity tabs. Edit profile, change salary, register documents and add timeline notes.
- **Attendance** -> monthly timesheet per employee. Edit status, check in/out, overtime and notes; save changes back to the register.
- **Payroll** -> run detail with cost KPIs, payroll trend, earnings composition, department cost, exceptions, finalize action, CSV export and payslip links.
- **Payslips** -> printable payslip with earnings and deductions, YTD totals, net pay trend and a prefilled Gmail draft.
- **Recruitment** -> pipeline KPIs. The Hire action converts an applicant into an employee with a code, join date, salary, hired event, leave balances, a closed job post and linked records.

Leave approvals update used days on the employee leave balance, and important changes write to the activity feed. Payroll runs, timesheets and expense claims export to CSV.

Overview, Reports, Recruitment, Expenses, Fuel & Vehicles, Forms and Team Tasks include charts and KPIs. Settings includes appearance controls (theme, font size, UI scale, density, corner radius).

## Run now, without Supabase (demo mode)

```bash
npm run dev   # repo root, open http://localhost:3000
```

With empty `NEXT_PUBLIC_SUPABASE_*` values the app runs on seeded data kept in the browser's localStorage (`apps/web/lib/local-db.ts`): 20 employees, two months of attendance, eight finalized payroll runs, leave balances, documents, employee history, vehicles, maintenance and expense claims. Every module is usable: add/edit records, approve leave and claims, run payroll, print payslips. Reset the sample data from Settings -> Local demo data.

When Supabase is connected, the app switches to it automatically and the demo data is ignored.

## One-time setup

### Option A - fully local, no account (recommended to start)

```bash
npx supabase start          # first run downloads images (a few minutes)
npx supabase db reset       # applies supabase/migrations/*.sql
npx supabase status -o env  # copy API_URL -> NEXT_PUBLIC_SUPABASE_URL, ANON_KEY -> NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

- Studio (DB admin UI): http://127.0.0.1:54323
- Create the first login user via Studio Auto -> Auth -> Users -> Add user (or ask the agent).
- Stop with `npx supabase stop` (data persists in Docker volumes; `stop --no-backup` wipes it).

### Option B - hosted Supabase (needed for production)

1. **Create a Supabase project**: https://supabase.com/dashboard/new
2. **Run the schema**: Dashboard -> SQL editor -> paste and run each file in
   `supabase/migrations/` in order (0001, then 0002).
   (CLI alternative under VPN: `npx supabase login --token <token>`, `npx supabase link --project-ref <ref>`, `npx supabase db push`.)
3. **Create the first login user**: Dashboard -> Project Settings -> Authentication -> Users -> Add user -> email + password.
4. **Fill `apps/web/.env.local`** (or `.env.example` in CI) with the project URL and anon key (Project Settings -> API).
5. `npm run dev` (repo root - runs all workspaces) and open http://localhost:3000.

## Verification commands

```bash
npm run check:payroll   # tax/SSB math self-check (apps/web)
npm run check:localdb   # offline demo store self-check (apps/web)
npm run check:csv       # CSV escaping self-check (apps/web)
npm run typecheck
npm run build
```

## Payroll rules (all editable in Settings)

- Monthly PAYE: earned income relief 20%, progressive PIT 0-25% (brackets are JSON rows: `up_to` + `rate`, last bracket has `up_to: null`).
- SSB: employee 2%, employer 3%, contribution basis clamped 40,000 - 300,000 MMK.
- Basic pay prorated by payable days: present/leave/holiday = 1 day, half-day = 0.5, absent = 0.
- OT: `base_salary / (standard_work_days * 8) * ot_multiplier`, skipped when the employee is marked `not OT eligible` or absent.
- Draft runs can be edited and recomputed; finalize locks the run and enables payslips.

## Notes

- Attendance `check_in/out` store wall-clock "HH:MM" as timestamptz "HH:MM:00Z" (see `lib/format.ts`).
- RLS: all tables are staff-wide (any authenticated user). Tighten when adding employee self-service.
- Gmail Automation opens prefilled Gmail compose windows. Automatic sending needs the Gmail API plus a server-side job.
- Documents are a metadata register for now. File upload waits for Supabase Storage.
- Leave approvals adjust `leave_balances.used_days` for the request year and type. Rejecting or editing an approved request reverses the old usage first. Attendance is not overwritten by leave approval; the timesheet stays the authoritative attendance register.
- Hiring an applicant closes its job post and links the new employee through `applicants.employee_id` (migration 0002).
- Appearance preferences live in localStorage (`hr-appearance-v1`, `apps/web/lib/appearance.ts`) and apply before first paint.
- The demo store mimics only the query features this app uses. It is not a general Supabase replacement.
