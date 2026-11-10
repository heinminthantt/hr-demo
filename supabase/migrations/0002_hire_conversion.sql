-- Link a hired applicant to the employee record created from it.
alter table applicants
  add column if not exists employee_id uuid references employees(id) on delete set null;

create index if not exists applicants_employee_id_idx on applicants (employee_id);
