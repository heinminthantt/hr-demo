// Self-check for payroll math: `npm run check:payroll` in apps/web
import {
  calcPit,
  calcPayslip,
  workDaysFrom,
  otHoursFrom,
  type PitBracket,
} from "../lib/payroll.ts"

let failed = 0
function eq(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failed++
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  } else {
    console.log(`ok   ${label}`)
  }
}

const bracketsStd: PitBracket[] = [
  { up_to: 125000, rate: 0 },
  { up_to: 250000, rate: 5 },
  { up_to: 583334, rate: 10 },
  { up_to: 1041667, rate: 15 },
  { up_to: 2000000, rate: 20 },
  { up_to: null, rate: 25 },
]

// PIT: first bracket 0% up to 125k
eq(calcPit(100000, bracketsStd), 0, "PIT below threshold = 0")
// 130k -> 5k taxed at 5% = 250
eq(calcPit(130000, bracketsStd), 250, "PIT crosses into 5%")
// 300000 -> (250000-125000)*5% = 6250 ; (300000-250000)*10% = 5000 => 11250
eq(calcPit(300000, bracketsStd), 11250, "PIT ten percent slice")
// 3,000,000 fully progressive
eq(
  calcPit(3000000, bracketsStd),
  Math.floor(
    (250000 - 125000) * 0.05 + (583334 - 250000) * 0.1 + (1041667 - 583334) * 0.15 +
      (2000000 - 1041667) * 0.2 + (3000000 - 2000000) * 0.25
  ),
  "PIT high earner"
)
eq(calcPit(0, bracketsStd), 0, "PIT zero")
eq(calcPit(-5, bracketsStd), 0, "PIT negative")
// null bracket first is handled (sorted anyway)
eq(calcPit(10000, [{ up_to: null, rate: 10 }]), 1000, "PIT single open bracket")

const settings = {
  currency: "MMK",
  ssb_employee_pct: 2,
  ssb_employer_pct: 3,
  ssb_base_min: 40000,
  ssb_base_max: 300000,
  pit_relief_pct: 20,
  pit_brackets: bracketsStd,
  ot_multiplier: 1.5,
  standard_work_days: 26,
}

const emp = {
  id: "e1",
  employee_code: "EMP-001",
  name: "Test Nya",
  join_date: "2020-01-01",
  resigned_on: null,
  status: "active",
  ot_eligible: true,
  base_salary: 1040000, // 40,000/day
}

// full month, no OT: basic=1040000, relief=208000, taxable=832000
const calc = calcPayslip(emp, 26, 0, {}, settings)
eq(calc.basic_amount, 1040000, "basic full month")
const expectedTax = calcPit(Math.max(0, 1040000 - Math.floor(1040000 * 0.2)), bracketsStd)
eq(calc.pit, expectedTax, "PIT matches relief then brackets")
eq(calc.ssb_employee, Math.round(300000 * 0.02), "SSB employee capped at 300000 basis")
eq(calc.ssb_employer, Math.round(300000 * 0.03), "SSB employer capped")
eq(calc.net_pay, 1040000 - expectedTax - calc.ssb_employee, "net = gross - SSB - PIT")
// low salary: SSB floor kicks in
const junior = { ...emp, base_salary: 20000, name: "Junior" }
const calc2 = calcPayslip(junior, 26, 0, {}, settings)
eq(calc2.ssb_employee, Math.round(40000 * 0.02), "SSB employee floored at 40000 basis")
eq(calc2.basic_amount, 20000, "junior basic")
// OT: 40,000/day / 8h * 1.5 = 7500/h -> 10h = 75000
const calc3 = calcPayslip(emp, 26, 10, {}, settings)
eq(calc3.ot_amount, 75000, "OT amount")
// prorated: 13 days = half salary
eq(calcPayslip(emp, 13, 0, {}, settings).basic_amount, 520000, "prorated half month")
// allowances & deductions flow into net
const calc4 = calcPayslip(emp, 26, 0, { allowance: 100000, other_deduction: 5000 }, settings)
eq(calc4.net_pay, 1040000 + 100000 - 5000 - calc4.pit - calc4.ssb_employee, "net includes allowance + deduction")
// ot not eligible
const noOt = { ...emp, ot_eligible: false }
eq(calcPayslip(noOt, 26, 10, {}, settings).ot_amount, 0, "ot_eligible=false disables OT")

// attendance weights
eq(workDaysFrom([{ employee_id: "e1", status: "present", ot_hours: 2, work_date: "" }]), 1, "weight present")
eq(
  workDaysFrom([
    { employee_id: "e1", status: "present", ot_hours: 2, work_date: "" },
    { employee_id: "e1", status: "half_day", ot_hours: 0, work_date: "" },
    { employee_id: "e1", status: "absent", ot_hours: 0, work_date: "" },
    { employee_id: "e1", status: "leave", ot_hours: 0, work_date: "" },
  ]),
  2.5,
  "weights mixed"
)
// OT on absent day not counted
eq(
  otHoursFrom([
    { employee_id: "e1", status: "present", ot_hours: 2, work_date: "" },
    { employee_id: "e1", status: "absent", ot_hours: 3, work_date: "" },
  ]),
  2,
  "OT ignored on absent day"
)

if (failed) {
  console.error(`\n${failed} check(s) FAILED`)
  process.exit(1)
}
console.log("\nAll payroll checks passed")
