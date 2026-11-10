-- HR Admin core schema. Run once in Supabase SQL editor (or `supabase db push`).
-- Modules: Employees, Attendance, Payroll runs, Payslips, Settings (PIT & SSB).

create table employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  name text not null,
  nrc_no text,
  phone text,
  email text,
  address text,
  department text not null default 'General',
  position text not null default 'Staff',
  employment_type text not null default 'full_time',  -- full_time | part_time | contract
  join_date date not null,
  base_salary numeric(14,2) not null default 0,       -- monthly basic, MMK
  ot_eligible boolean not null default true,
  status text not null default 'active',              -- active | resigned
  resigned_on date,
  created_at timestamptz not null default now()
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  work_date date not null,
  check_in timestamptz,        -- wall-clock time stored as "HH:MM:00Z" (see lib/format.ts)
  check_out timestamptz,
  status text not null default 'present',  -- present | half_day | absent | leave | holiday
  ot_hours numeric(5,2) not null default 0,
  notes text,
  unique (employee_id, work_date)
);

create table payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_month int not null check (period_month between 1 and 12),
  period_year int not null,
  status text not null default 'draft',     -- draft | finalized
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  unique (period_month, period_year)
);

create table payslips (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references payroll_runs(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete restrict,
  work_days numeric(5,1) not null default 0,
  basic_amount numeric(14,2) not null default 0,
  ot_amount numeric(14,2) not null default 0,
  allowance numeric(14,2) not null default 0,
  other_bonus numeric(14,2) not null default 0,
  absence_deduction numeric(14,2) not null default 0,
  other_deduction numeric(14,2) not null default 0,
  ssb_employee numeric(14,2) not null default 0,
  ssb_employer numeric(14,2) not null default 0,
  pit numeric(14,2) not null default 0,
  net_pay numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (run_id, employee_id)
);

-- Single-row settings (PIT & SSB page). Default brackets: monthly PAYE 2025, PIT 0-25%.
create table app_settings (
  id int primary key default 1 check (id = 1),
  currency text not null default 'MMK',
  ssb_employee_pct numeric(5,2) not null default 2.00,
  ssb_employer_pct numeric(5,2) not null default 3.00,
  ssb_base_min numeric(14,2) not null default 40000,
  ssb_base_max numeric(14,2) not null default 300000,
  pit_relief_pct numeric(5,2) not null default 20,
  pit_brackets jsonb not null,
  ot_multiplier numeric(5,2) not null default 1.5,
  standard_work_days numeric(5,1) not null default 26,
  updated_at timestamptz not null default now()
);

insert into app_settings (id, pit_brackets)
values (
  1,
  '[{"up_to":125000,"rate":0},{"up_to":250000,"rate":5},{"up_to":583333,"rate":10},{"up_to":1041666,"rate":15},{"up_to":2000000,"rate":20},{"up_to":null,"rate":25}]'::jsonb
);

-- Forms: leave requests with a simple approve/reject flow.
create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type text not null default 'annual',   -- annual | sick | unpaid | other
  start_date date not null,
  end_date date not null,
  days numeric(5,1) not null default 1,
  reason text,
  status text not null default 'pending',      -- pending | approved | rejected
  created_at timestamptz not null default now()
);

-- Team Tasks.
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  assignee_id uuid references employees(id) on delete set null,
  due_date date,
  priority text not null default 'normal',      -- low | normal | high
  status text not null default 'todo',          -- todo | doing | done
  notes text,
  created_at timestamptz not null default now()
);

-- Recruitment: job posts and applicants.
create table job_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department text not null default 'General',
  employment_type text not null default 'full_time',
  description text,
  status text not null default 'open',          -- open | closed
  created_at timestamptz not null default now()
);

create table applicants (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references job_posts(id) on delete set null,
  name text not null,
  email text,
  phone text,
  stage text not null default 'applied',        -- applied | screening | interview | offer | hired | rejected
  notes text,
  applied_on date not null default current_date,
  created_at timestamptz not null default now()
);

-- Fuel & Vehicles.
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  plate_no text not null unique,
  model text,
  driver_name text,
  status text not null default 'active',        -- active | maintenance | retired
  created_at timestamptz not null default now()
);

create table fuel_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  log_date date not null default current_date,
  liters numeric(8,2) not null default 0,
  cost numeric(14,2) not null default 0,
  odometer numeric(10,1),
  notes text,
  created_at timestamptz not null default now()
);

-- Expense Claims.
create table expense_claims (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  claim_date date not null default current_date,
  category text not null default 'other',       -- travel | meals | supplies | fuel | other
  description text,
  amount numeric(14,2) not null default 0,
  status text not null default 'pending',       -- pending | approved | reimbursed | rejected
  created_at timestamptz not null default now()
);

-- Gmail Automation: prefilled draft templates (sending happens in Gmail).
create table email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null default '',
  body text not null default '',
  updated_at timestamptz not null default now()
);

-- Employee lifecycle history: hires, promotions, transfers, salary changes, notes.
create table employee_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  event_type text not null default 'note',       -- hired | promotion | transfer | salary_change | status_change | note
  effective_date date not null default current_date,
  title text not null,
  detail text,
  amount numeric(14,2),
  created_at timestamptz not null default now()
);

-- Leave entitlements and usage per employee, leave type and year.
create table leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type text not null default 'annual',     -- annual | sick | unpaid | other
  year integer not null,
  entitled_days numeric(5,1) not null default 0,
  used_days numeric(5,1) not null default 0,
  created_at timestamptz not null default now(),
  unique (employee_id, leave_type, year)
);

-- Document register. Files live in Supabase Storage later; this tracks metadata now.
create table employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  name text not null,
  doc_type text not null default 'other',        -- contract | id | licence | certificate | other
  issued_on date,
  expires_on date,
  reference text,
  file_url text,
  notes text,
  created_at timestamptz not null default now()
);

-- Vehicle service history.
create table vehicle_maintenance (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  service_date date not null default current_date,
  description text not null,
  cost numeric(14,2) not null default 0,
  odometer numeric(10,1),
  next_due date,
  created_at timestamptz not null default now()
);

-- Unified activity trail used by record pages and the overview feed.
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  entity_id text,
  action text not null,
  detail text,
  actor text not null default 'HR Admin',
  created_at timestamptz not null default now()
);

-- Internal HR admin tool: every authenticated user (created in dashboard) is staff.
-- Tighten per-role later if employee self-service is added.
alter table employees enable row level security;
alter table attendance enable row level security;
alter table payroll_runs enable row level security;
alter table payslips enable row level security;
alter table app_settings enable row level security;
alter table leave_requests enable row level security;
alter table tasks enable row level security;
alter table job_posts enable row level security;
alter table applicants enable row level security;
alter table vehicles enable row level security;
alter table fuel_logs enable row level security;
alter table expense_claims enable row level security;
alter table email_templates enable row level security;
alter table employee_events enable row level security;
alter table leave_balances enable row level security;
alter table employee_documents enable row level security;
alter table vehicle_maintenance enable row level security;
alter table activity_log enable row level security;

create policy "staff_all_employees" on employees for all to authenticated using (true) with check (true);
create policy "staff_all_attendance" on attendance for all to authenticated using (true) with check (true);
create policy "staff_all_payroll_runs" on payroll_runs for all to authenticated using (true) with check (true);
create policy "staff_all_payslips" on payslips for all to authenticated using (true) with check (true);
create policy "staff_all_settings" on app_settings for all to authenticated using (true) with check (true);
create policy "staff_all_leave_requests" on leave_requests for all to authenticated using (true) with check (true);
create policy "staff_all_tasks" on tasks for all to authenticated using (true) with check (true);
create policy "staff_all_job_posts" on job_posts for all to authenticated using (true) with check (true);
create policy "staff_all_applicants" on applicants for all to authenticated using (true) with check (true);
create policy "staff_all_vehicles" on vehicles for all to authenticated using (true) with check (true);
create policy "staff_all_fuel_logs" on fuel_logs for all to authenticated using (true) with check (true);
create policy "staff_all_expense_claims" on expense_claims for all to authenticated using (true) with check (true);
create policy "staff_all_email_templates" on email_templates for all to authenticated using (true) with check (true);
create policy "staff_all_employee_events" on employee_events for all to authenticated using (true) with check (true);
create policy "staff_all_leave_balances" on leave_balances for all to authenticated using (true) with check (true);
create policy "staff_all_employee_documents" on employee_documents for all to authenticated using (true) with check (true);
create policy "staff_all_vehicle_maintenance" on vehicle_maintenance for all to authenticated using (true) with check (true);
create policy "staff_all_activity_log" on activity_log for all to authenticated using (true) with check (true);
