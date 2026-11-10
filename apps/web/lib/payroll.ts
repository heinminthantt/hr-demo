// Pure payroll math - Myanmar monthly PAYE, customizable via app_settings row.
// Self-check: apps/web/scripts/payroll-check.ts

export type PitBracket = { up_to: number | null; rate: number } // up_to: null = last/open bracket

export type AppSettings = {
  currency: string
  ssb_employee_pct: number
  ssb_employer_pct: number
  ssb_base_min: number
  ssb_base_max: number
  pit_relief_pct: number // earned income relief %
  pit_brackets: PitBracket[]
  ot_multiplier: number
  standard_work_days: number
}

export type AppSettingsRow = AppSettings & {
  id: number
  updated_at: string
}

export type EmployeeRow = {
  id: string
  employee_code: string
  name: string
  nrc_no: string | null
  phone: string | null
  email: string | null
  address: string | null
  department: string
  position: string
  employment_type: string // full_time | part_time | contract
  join_date: string
  base_salary: number
  ot_eligible: boolean
  status: string // active | resigned
  resigned_on: string | null
  created_at: string
}

// Rows include only what DB returns; EmployeeLite is the slice payroll needs.
export type EmployeeLite = Pick<
  EmployeeRow,
  "id" | "employee_code" | "name" | "base_salary" | "join_date" | "resigned_on" | "status" | "ot_eligible"
>

export type AttendanceRow = {
  id: string
  employee_id: string
  work_date: string
  check_in: string | null
  check_out: string | null
  status: string // present | half_day | absent | leave | holiday
  ot_hours: number
  notes: string | null
}

export type AttendanceLite = {
  employee_id: string
  status: string
  ot_hours: number
  work_date: string
}

export type PayrollRunRow = {
  id: string
  period_month: number
  period_year: number
  status: string // draft | finalized
  created_at: string
  finalized_at: string | null
}

export type PayslipRow = {
  id: string
  run_id: string
  employee_id: string
  work_days: number
  basic_amount: number
  ot_amount: number
  allowance: number
  other_bonus: number
  absence_deduction: number
  other_deduction: number
  ssb_employee: number
  ssb_employer: number
  pit: number
  net_pay: number
  created_at: string
}

export const WORKDAY_WEIGHTS: Record<string, number> = {
  present: 1,
  leave: 1,
  holiday: 1,
  half_day: 0.5,
  absent: 0,
}

export function attendanceLite(rows: AttendanceRow[] | AttendanceLite[]): AttendanceLite[] {
  return rows.map((r) => ({
    employee_id: r.employee_id,
    status: r.status,
    ot_hours: r.ot_hours ?? 0,
    work_date: r.work_date,
  }))
}

export function workDaysFrom(rows: AttendanceLite[]): number {
  return rows.reduce((s, r) => s + (WORKDAY_WEIGHTS[r.status] ?? 0), 0)
}

export function otHoursFrom(rows: AttendanceLite[]): number {
  return rows.reduce((s, r) => s + (r.status === "absent" ? 0 : r.ot_hours ?? 0), 0)
}

// Progressive tax. Brackets: [{up_to:125000,rate:0},{up_to:250000,rate:5},...,{up_to:null,rate:25}]
// floor() per slice + total - whole kyat, conservative for the employer.
export function calcPit(taxable: number, brackets: PitBracket[]): number {
  if (!Array.isArray(brackets) || brackets.length === 0 || taxable <= 0) return 0
  const sorted = [...brackets].sort((a, b) => (a.up_to ?? Infinity) - (b.up_to ?? Infinity))
  let lower = 0
  let tax = 0
  for (const b of sorted) {
    const upper = b.up_to ?? Infinity
    if (taxable <= lower) break
    tax += Math.max(0, Math.min(taxable, upper) - lower) * (b.rate / 100)
    lower = upper
    if (b.up_to === null) break
  }
  return Math.floor(tax)
}

export type ManualAdjustments = {
  allowance?: number
  other_bonus?: number
  absence_deduction?: number
  other_deduction?: number
}

export type PayslipCalc = Pick<
  PayslipRow,
  | "work_days"
  | "basic_amount"
  | "ot_amount"
  | "allowance"
  | "other_bonus"
  | "absence_deduction"
  | "other_deduction"
  | "ssb_employee"
  | "ssb_employer"
  | "pit"
  | "net_pay"
>

export function calcPayslip(
  emp: EmployeeLite,
  workDays: number,
  otHours: number,
  manual: ManualAdjustments,
  s: AppSettings
): PayslipCalc {
  const std = Math.max(1, s.standard_work_days || 26)
  const basic = Math.round((emp.base_salary * workDays) / std)
  const otAmount =
    emp.ot_eligible && otHours > 0
      ? Math.round((emp.base_salary / (std * 8)) * s.ot_multiplier * otHours)
      : 0
  const allowance = manual.allowance ?? 0
  const bonus = manual.other_bonus ?? 0
  const gross = basic + otAmount + allowance + bonus
  const relief = Math.floor((gross * (s.pit_relief_pct ?? 20)) / 100)
  const pit = calcPit(Math.max(0, gross - relief), s.pit_brackets ?? [])
  // SSB applies to the official contribution basis, not the actual salary
  const basis = Math.min(Math.max(emp.base_salary, s.ssb_base_min), s.ssb_base_max)
  const ssbEmployee = Math.round((basis * s.ssb_employee_pct) / 100)
  const ssbEmployer = Math.round((basis * s.ssb_employer_pct) / 100)
  const absenceDeduction = manual.absence_deduction ?? 0
  const otherDeduction = manual.other_deduction ?? 0
  const netPay = gross - ssbEmployee - pit - absenceDeduction - otherDeduction
  return {
    work_days: workDays,
    basic_amount: basic,
    ot_amount: otAmount,
    allowance,
    other_bonus: bonus,
    absence_deduction: absenceDeduction,
    other_deduction: otherDeduction,
    ssb_employee: ssbEmployee,
    ssb_employer: ssbEmployer,
    pit,
    net_pay: netPay,
  }
}
