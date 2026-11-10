// Offline demo store. Mimics the small slice of the Supabase query API this app uses
// so every page runs with seeded data until NEXT_PUBLIC_SUPABASE_* is set.
// Self-check: apps/web/scripts/local-db-check.ts

import { calcPayslip, type AppSettings } from "./payroll.ts"

type Row = Record<string, any>
type Tables = Record<string, Row[]>
type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const LOCAL_DB_KEY = "hr-local-db-v2"

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`

const dateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

const isoAt = (date: string, time: string) => new Date(`${date}T${time}:00Z`).toISOString()

const SETTINGS: AppSettings = {
  currency: "MMK",
  ssb_employee_pct: 2,
  ssb_employer_pct: 3,
  ssb_base_min: 40000,
  ssb_base_max: 300000,
  pit_relief_pct: 20,
  ot_multiplier: 1.5,
  standard_work_days: 26,
  pit_brackets: [
    { up_to: 125000, rate: 0 },
    { up_to: 250000, rate: 5 },
    { up_to: 583333, rate: 10 },
    { up_to: 1041666, rate: 15 },
    { up_to: 2000000, rate: 20 },
    { up_to: null, rate: 25 },
  ],
}

function seed(): Tables {
  const now = new Date()
  const nowIso = now.toISOString()
  const today = dateStr(now)
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const lastMonth = month === 1 ? 12 : month - 1
  const lastMonthYear = month === 1 ? year - 1 : year

  const shift = (days: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() + days)
    return dateStr(d)
  }

  const employees: Row[] = [
    { id: "emp-1", employee_code: "EMP-001", name: "Aung Ko", nrc_no: "12/ABC(N)123456", phone: "09 771 100 201", email: "aung.ko@example.com", address: "Yangon", department: "Operations", position: "Operations Supervisor", employment_type: "full_time", join_date: "2023-01-15", base_salary: 900000, ot_eligible: true, status: "active", resigned_on: null, created_at: nowIso },
    { id: "emp-2", employee_code: "EMP-002", name: "Su Myat Noe", nrc_no: "9/XYZ(N)654321", phone: "09 771 100 202", email: "su.myat@example.com", address: "Yangon", department: "Finance", position: "Accountant", employment_type: "full_time", join_date: "2022-08-01", base_salary: 750000, ot_eligible: false, status: "active", resigned_on: null, created_at: nowIso },
    { id: "emp-3", employee_code: "EMP-003", name: "Kyaw Zin", nrc_no: null, phone: "09 771 100 203", email: "kyaw.zin@example.com", address: "Mandalay", department: "Sales", position: "Sales Executive", employment_type: "full_time", join_date: "2024-03-04", base_salary: 600000, ot_eligible: true, status: "active", resigned_on: null, created_at: nowIso },
    { id: "emp-4", employee_code: "EMP-004", name: "Thiri Aung", nrc_no: null, phone: "09 771 100 204", email: "thiri.aung@example.com", address: "Yangon", department: "HR", position: "HR Officer", employment_type: "full_time", join_date: "2023-06-12", base_salary: 650000, ot_eligible: true, status: "active", resigned_on: null, created_at: nowIso },
    { id: "emp-5", employee_code: "EMP-005", name: "Min Khant", nrc_no: null, phone: "09 771 100 205", email: "min.khant@example.com", address: "Yangon", department: "Engineering", position: "Senior Developer", employment_type: "full_time", join_date: "2021-11-01", base_salary: 1200000, ot_eligible: true, status: "active", resigned_on: null, created_at: nowIso },
    { id: "emp-6", employee_code: "EMP-006", name: "Nandar Hlaing", nrc_no: null, phone: "09 771 100 206", email: "nandar.h@example.com", address: "Bago", department: "Admin", position: "Admin Assistant", employment_type: "part_time", join_date: "2025-02-03", base_salary: 450000, ot_eligible: false, status: "active", resigned_on: null, created_at: nowIso },
    { id: "emp-7", employee_code: "EMP-007", name: "Htet Naing", nrc_no: null, phone: "09 771 100 207", email: "htet.naing@example.com", address: "Yangon", department: "Sales", position: "Sales Manager", employment_type: "full_time", join_date: "2020-05-18", base_salary: 1100000, ot_eligible: false, status: "active", resigned_on: null, created_at: nowIso },
    { id: "emp-8", employee_code: "EMP-008", name: "Ei Phyu", nrc_no: null, phone: "09 771 100 208", email: "ei.phyu@example.com", address: "Yangon", department: "Finance", position: "Finance Manager", employment_type: "full_time", join_date: "2019-09-02", base_salary: 1300000, ot_eligible: false, status: "active", resigned_on: null, created_at: nowIso },
    { id: "emp-9", employee_code: "EMP-009", name: "Zaw Lin", nrc_no: null, phone: "09 771 100 209", email: "zaw.lin@example.com", address: "Mandalay", department: "Engineering", position: "Developer", employment_type: "full_time", join_date: "2024-07-15", base_salary: 850000, ot_eligible: true, status: "active", resigned_on: null, created_at: nowIso },
    { id: "emp-10", employee_code: "EMP-010", name: "Khin Myo", nrc_no: null, phone: "09 771 100 210", email: "khin.myo@example.com", address: "Yangon", department: "Marketing", position: "Marketing Executive", employment_type: "full_time", join_date: "2025-04-21", base_salary: 620000, ot_eligible: true, status: "active", resigned_on: null, created_at: nowIso },
    { id: "emp-11", employee_code: "EMP-011", name: "Phyo Wai", nrc_no: null, phone: "09 771 100 211", email: "phyo.wai@example.com", address: "Yangon", department: "Warehouse", position: "Warehouse Supervisor", employment_type: "full_time", join_date: "2022-12-05", base_salary: 700000, ot_eligible: true, status: "active", resigned_on: null, created_at: nowIso },
    { id: "emp-12", employee_code: "EMP-012", name: "Sandar Win", nrc_no: null, phone: "09 771 100 212", email: "sandar.win@example.com", address: "Bago", department: "Operations", position: "Dispatcher", employment_type: "full_time", join_date: "2024-10-07", base_salary: 520000, ot_eligible: true, status: "active", resigned_on: null, created_at: nowIso },
    { id: "emp-13", employee_code: "EMP-013", name: "Myo Set", nrc_no: null, phone: "09 771 100 213", email: "myo.set@example.com", address: "Yangon", department: "Engineering", position: "QA Engineer", employment_type: "full_time", join_date: "2023-08-14", base_salary: 780000, ot_eligible: true, status: "active", resigned_on: null, created_at: nowIso },
    { id: "emp-14", employee_code: "EMP-014", name: "Yu Yu", nrc_no: null, phone: "09 771 100 214", email: "yu.yu@example.com", address: "Yangon", department: "HR", position: "Recruiter", employment_type: "full_time", join_date: "2025-06-09", base_salary: 680000, ot_eligible: false, status: "active", resigned_on: null, created_at: nowIso },
    { id: "emp-15", employee_code: "EMP-015", name: "Ko Ko", nrc_no: null, phone: "09 771 100 215", email: "ko.ko@example.com", address: "Mandalay", department: "Sales", position: "Account Manager", employment_type: "full_time", join_date: "2021-02-22", base_salary: 720000, ot_eligible: true, status: "active", resigned_on: null, created_at: nowIso },
    { id: "emp-16", employee_code: "EMP-016", name: "Lin Lin", nrc_no: null, phone: "09 771 100 216", email: "lin.lin@example.com", address: "Yangon", department: "Finance", position: "Accounts Payable", employment_type: "full_time", join_date: "2025-09-01", base_salary: 550000, ot_eligible: false, status: "active", resigned_on: null, created_at: nowIso },
    { id: "emp-17", employee_code: "EMP-017", name: "Nay Lin", nrc_no: null, phone: "09 771 100 217", email: "nay.lin@example.com", address: "Yangon", department: "Marketing", position: "Content Designer", employment_type: "full_time", join_date: "2024-01-29", base_salary: 580000, ot_eligible: false, status: "resigned", resigned_on: "2026-06-30", created_at: nowIso },
    { id: "emp-18", employee_code: "EMP-018", name: "Wai Yan", nrc_no: null, phone: "09 771 100 218", email: "wai.yan@example.com", address: "Bago", department: "Warehouse", position: "Driver", employment_type: "full_time", join_date: "2023-11-13", base_salary: 420000, ot_eligible: true, status: "resigned", resigned_on: "2025-12-31", created_at: nowIso },
    { id: "emp-19", employee_code: "EMP-019", name: "Thant Zin", nrc_no: null, phone: "09 771 100 219", email: "thant.zin@example.com", address: "Yangon", department: "Engineering", position: "Junior Developer", employment_type: "full_time", join_date: "2026-10-05", base_salary: 500000, ot_eligible: true, status: "active", resigned_on: null, created_at: nowIso },
    { id: "emp-20", employee_code: "EMP-020", name: "May Thu", nrc_no: null, phone: "09 771 100 220", email: "may.thu@example.com", address: "Yangon", department: "Operations", position: "Logistics Assistant", employment_type: "full_time", join_date: "2026-11-02", base_salary: 480000, ot_eligible: true, status: "active", resigned_on: null, created_at: nowIso },
  ]

  const workDates = (from: Date, to: Date) => {
    const out: string[] = []
    for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0) out.push(dateStr(d))
    }
    return out
  }

  const activeOn = (e: Row, date: string) =>
    e.join_date <= date && (!e.resigned_on || e.resigned_on >= date)

  const lastMonthStart = `${lastMonthYear}-${String(lastMonth).padStart(2, "0")}-01`
  const lastMonthEndDate = new Date(lastMonthYear, lastMonth, 0)
  const lastMonthEnd = dateStr(lastMonthEndDate)
  const lastMonthDates = workDates(new Date(lastMonthYear, lastMonth - 1, 1), lastMonthEndDate)
  const monthDates = workDates(new Date(year, month - 1, 1), now)
  const allDates = [...lastMonthDates, ...monthDates]

  const attendance: Row[] = []
  let attendanceSeq = 0
  for (const date of allDates) {
    if (date > today) continue
    const day = Number(date.slice(8, 10))
    employees.forEach((e, idx) => {
      if (!activeOn(e, date)) return
      let status = "present"
      let checkIn = "09:00"
      let checkOut = "17:30"
      let ot = 0
      let notes: string | null = null
      if ((idx + day) % 19 === 0) {
        status = "absent"
        checkIn = ""
        checkOut = ""
        notes = "Unplanned absence"
      } else if ((idx + day) % 23 === 0) {
        status = "leave"
        checkIn = ""
        checkOut = ""
        notes = "Approved leave"
      } else if ((idx + day) % 17 === 0) {
        status = "half_day"
        checkOut = "13:00"
        notes = "Half day"
      } else if ((idx + day) % 7 === 0 && e.ot_eligible) {
        ot = 1.5
        checkOut = "19:30"
      } else if ((idx + day) % 5 === 0) {
        checkIn = "09:18"
        notes = "Late arrival"
      }
      if (date === today) {
        if (e.id === "emp-6") { status = "leave"; checkIn = ""; checkOut = ""; ot = 0; notes = "Annual leave" }
        if (e.id === "emp-3") { status = "absent"; checkIn = ""; checkOut = ""; ot = 0; notes = "Sick" }
        if (e.id === "emp-5") { ot = 2; checkOut = "19:30"; notes = null }
        if (e.id === "emp-10") { status = "leave"; checkIn = ""; checkOut = ""; ot = 0; notes = "Annual leave" }
        if (e.id === "emp-12") { status = "half_day"; checkOut = "13:00"; notes = "Half day" }
        if (e.id === "emp-16") { checkIn = "09:26"; notes = "Late arrival" }
      }
      attendance.push({
        id: `att-${++attendanceSeq}`,
        employee_id: e.id,
        work_date: date,
        check_in: checkIn ? isoAt(date, checkIn) : null,
        check_out: checkOut ? isoAt(date, checkOut) : null,
        status,
        ot_hours: ot,
        notes,
      })
    })
  }

  const countWorkDays = (start: string, end: string) => {
    if (start > end) return 0
    let count = 0
    const d = new Date(`${start}T00:00:00`)
    const stop = new Date(`${end}T00:00:00`)
    while (d <= stop) {
      if (d.getDay() !== 0) count++
      d.setDate(d.getDate() + 1)
    }
    return count
  }

  const payrollRuns: Row[] = []
  const payslips: Row[] = []
  const activities: Row[] = []
  let activitySeq = 0

  for (let offset = 8; offset >= 1; offset--) {
    const period = new Date(year, month - 1 - offset, 1)
    const py = period.getFullYear()
    const pm = period.getMonth() + 1
    const start = `${py}-${String(pm).padStart(2, "0")}-01`
    const end = dateStr(new Date(py, pm, 0))
    const runId = `run-${py}-${String(pm).padStart(2, "0")}`
    const finalizedAt = `${end}T17:00:00.000Z`
    payrollRuns.push({
      id: runId,
      period_month: pm,
      period_year: py,
      status: "finalized",
      created_at: finalizedAt,
      finalized_at: finalizedAt,
    })

    employees.forEach((e, idx) => {
      if (e.join_date > end || (e.resigned_on && e.resigned_on < start)) return
      const from = e.join_date > start ? e.join_date : start
      const to = e.resigned_on && e.resigned_on < end ? e.resigned_on : end
      const days = Math.min(SETTINGS.standard_work_days, countWorkDays(from, to))
      const ot = e.ot_eligible ? ((idx + offset) % 4) * 1.5 : 0
      const isManager = /Manager|Supervisor/.test(e.position)
      const calc = calcPayslip(
        { id: e.id, employee_code: e.employee_code, name: e.name, base_salary: e.base_salary, join_date: e.join_date, resigned_on: e.resigned_on, status: e.status, ot_eligible: e.ot_eligible },
        days,
        ot,
        {
          allowance: isManager ? 50000 : 0,
          other_bonus: (idx + offset) % 6 === 0 ? 100000 : 0,
          other_deduction: (idx + offset) % 9 === 0 ? 20000 : 0,
        },
        SETTINGS
      )
      payslips.push({
        id: `slip-${runId}-${e.id}`,
        run_id: runId,
        employee_id: e.id,
        ...calc,
        created_at: finalizedAt,
      })
    })

    activities.push({
      id: `act-${++activitySeq}`,
      entity: "payroll_run",
      entity_id: runId,
      action: "finalized",
      detail: `${pm}/${py} payroll run finalized`,
      actor: "HR Admin",
      created_at: finalizedAt,
    })
  }

  const tasks: Row[] = [
    { id: "task-1", title: "Prepare November payroll", assignee_id: "emp-4", due_date: shift(2), priority: "high", status: "doing", notes: "Verify OT hours before finalizing.", created_at: nowIso },
    { id: "task-2", title: "Update staff phone list", assignee_id: "emp-6", due_date: shift(-2), priority: "normal", status: "todo", notes: null, created_at: nowIso },
    { id: "task-3", title: "Interview sales shortlist", assignee_id: "emp-7", due_date: shift(3), priority: "normal", status: "todo", notes: "Three candidates this week.", created_at: nowIso },
    { id: "task-4", title: "Reconcile fuel receipts", assignee_id: "emp-2", due_date: shift(-1), priority: "low", status: "done", notes: null, created_at: nowIso },
    { id: "task-5", title: "Renew vehicle insurance", assignee_id: "emp-1", due_date: shift(7), priority: "high", status: "todo", notes: "Hiace and Fuso policies expire soon.", created_at: nowIso },
    { id: "task-6", title: "Close October expense claims", assignee_id: "emp-8", due_date: shift(4), priority: "normal", status: "doing", notes: null, created_at: nowIso },
    { id: "task-7", title: "Schedule safety training", assignee_id: "emp-11", due_date: shift(10), priority: "low", status: "todo", notes: "Warehouse team, two sessions.", created_at: nowIso },
    { id: "task-8", title: "Publish engineering job post", assignee_id: "emp-14", due_date: shift(-3), priority: "high", status: "doing", notes: null, created_at: nowIso },
    { id: "task-9", title: "Review probation for May Thu", assignee_id: "emp-4", due_date: shift(14), priority: "normal", status: "todo", notes: null, created_at: nowIso },
    { id: "task-10", title: "Send payslip notifications", assignee_id: "emp-4", due_date: shift(5), priority: "normal", status: "todo", notes: null, created_at: nowIso },
  ]

  const leaveRequests: Row[] = [
    { id: "leave-1", employee_id: "emp-3", leave_type: "annual", start_date: today, end_date: today, days: 1, reason: "Family matter", status: "approved", created_at: nowIso },
    { id: "leave-2", employee_id: "emp-6", leave_type: "sick", start_date: today, end_date: today, days: 1, reason: "Fever", status: "pending", created_at: nowIso },
    { id: "leave-3", employee_id: "emp-2", leave_type: "unpaid", start_date: today, end_date: today, days: 1, reason: "Personal trip", status: "pending", created_at: nowIso },
    { id: "leave-4", employee_id: "emp-5", leave_type: "annual", start_date: shift(-24), end_date: shift(-22), days: 3, reason: "Family visit", status: "approved", created_at: nowIso },
    { id: "leave-5", employee_id: "emp-10", leave_type: "sick", start_date: shift(-18), end_date: shift(-17), days: 2, reason: "Medical leave", status: "rejected", created_at: nowIso },
    { id: "leave-6", employee_id: "emp-8", leave_type: "annual", start_date: shift(-60), end_date: shift(-56), days: 5, reason: "Annual holiday", status: "approved", created_at: nowIso },
    { id: "leave-7", employee_id: "emp-12", leave_type: "annual", start_date: shift(6), end_date: shift(8), days: 3, reason: "Wedding", status: "pending", created_at: nowIso },
    { id: "leave-8", employee_id: "emp-7", leave_type: "sick", start_date: shift(-12), end_date: shift(-12), days: 1, reason: "Dental appointment", status: "approved", created_at: nowIso },
    { id: "leave-9", employee_id: "emp-15", leave_type: "other", start_date: shift(2), end_date: shift(3), days: 2, reason: "Community event", status: "pending", created_at: nowIso },
    { id: "leave-10", employee_id: "emp-1", leave_type: "annual", start_date: shift(-90), end_date: shift(-87), days: 4, reason: "Family trip", status: "approved", created_at: nowIso },
    { id: "leave-11", employee_id: "emp-18", leave_type: "unpaid", start_date: "2025-11-10", end_date: "2025-11-11", days: 2, reason: "Personal", status: "rejected", created_at: nowIso },
    { id: "leave-12", employee_id: "emp-14", leave_type: "other", start_date: shift(-5), end_date: shift(-4), days: 2, reason: "Volunteer day", status: "approved", created_at: nowIso },
  ]

  const leaveBalances: Row[] = []
  employees.forEach((e, idx) => {
    if (e.status !== "active") return
    const approved = leaveRequests.filter((l) => l.employee_id === e.id && l.status === "approved")
    const used = (type: string) => approved.filter((l) => l.leave_type === type).reduce((s, l) => s + Number(l.days), 0)
    leaveBalances.push(
      { id: `lb-${e.id}-annual-${year}`, employee_id: e.id, leave_type: "annual", year, entitled_days: 14, used_days: Math.min(14, 2 + (idx % 5) + used("annual")), created_at: nowIso },
      { id: `lb-${e.id}-sick-${year}`, employee_id: e.id, leave_type: "sick", year, entitled_days: 7, used_days: 1 + (idx % 3) + used("sick"), created_at: nowIso },
      { id: `lb-${e.id}-unpaid-${year}`, employee_id: e.id, leave_type: "unpaid", year, entitled_days: 0, used_days: used("unpaid"), created_at: nowIso },
      { id: `lb-${e.id}-other-${year}`, employee_id: e.id, leave_type: "other", year, entitled_days: 3, used_days: used("other"), created_at: nowIso }
    )
  })

  const documents: Row[] = []
  employees.forEach((e, idx) => {
    documents.push({
      id: `doc-${e.id}-contract`,
      employee_id: e.id,
      name: "Employment contract",
      doc_type: "contract",
      issued_on: e.join_date,
      expires_on: null,
      reference: `CT-${e.employee_code}`,
      file_url: null,
      notes: "Signed contract on file.",
      created_at: nowIso,
    })
    documents.push({
      id: `doc-${e.id}-nrc`,
      employee_id: e.id,
      name: "NRC copy",
      doc_type: "id",
      issued_on: e.join_date,
      expires_on: null,
      reference: e.nrc_no ?? null,
      file_url: null,
      notes: null,
      created_at: nowIso,
    })
    if (idx % 4 === 0 || e.id === "emp-7") {
      documents.push({
        id: `doc-${e.id}-licence`,
        employee_id: e.id,
        name: "Driving licence",
        doc_type: "licence",
        issued_on: "2022-04-11",
        expires_on: e.id === "emp-7" ? shift(-15) : "2027-04-10",
        reference: `DL-${e.employee_code}`,
        file_url: null,
        notes: null,
        created_at: nowIso,
      })
    }
    if (e.id === "emp-19" || e.id === "emp-20") {
      documents.push({
        id: `doc-${e.id}-permit`,
        employee_id: e.id,
        name: "Probation review",
        doc_type: "other",
        issued_on: e.join_date,
        expires_on: shift(e.id === "emp-19" ? 40 : 55),
        reference: `PROB-${e.employee_code}`,
        file_url: null,
        notes: "Review before confirmation.",
        created_at: nowIso,
      })
    }
    if (idx % 3 === 0) {
      documents.push({
        id: `doc-${e.id}-cert`,
        employee_id: e.id,
        name: "Professional certificate",
        doc_type: "certificate",
        issued_on: "2024-08-19",
        expires_on: "2027-08-18",
        reference: `CERT-${e.employee_code}`,
        file_url: null,
        notes: null,
        created_at: nowIso,
      })
    }
  })

  const employeeEvents: Row[] = []
  let eventSeq = 0
  employees.forEach((e, idx) => {
    employeeEvents.push({
      id: `evt-${++eventSeq}`,
      employee_id: e.id,
      event_type: "hired",
      effective_date: e.join_date,
      title: "Joined company",
      detail: `${e.position}, ${e.department}`,
      amount: e.id === "emp-5" ? 1050000 : e.id === "emp-7" ? 950000 : e.id === "emp-2" ? 680000 : e.base_salary,
      created_at: nowIso,
    })
    if (e.id === "emp-5") employeeEvents.push({ id: `evt-${++eventSeq}`, employee_id: e.id, event_type: "salary_change", effective_date: "2026-01-01", title: "Salary increased", detail: "Annual review", amount: 1200000, created_at: nowIso })
    if (e.id === "emp-7") employeeEvents.push({ id: `evt-${++eventSeq}`, employee_id: e.id, event_type: "salary_change", effective_date: "2025-07-01", title: "Salary increased", detail: "Promotion to Sales Manager", amount: 1100000, created_at: nowIso })
    if (e.id === "emp-2") employeeEvents.push({ id: `evt-${++eventSeq}`, employee_id: e.id, event_type: "salary_change", effective_date: "2026-04-01", title: "Salary increased", detail: "Annual review", amount: 750000, created_at: nowIso })
    if (e.id === "emp-4") employeeEvents.push({ id: `evt-${++eventSeq}`, employee_id: e.id, event_type: "promotion", effective_date: "2025-01-01", title: "Promoted to HR Officer", detail: "People operations", amount: null, created_at: nowIso })
    if (e.id === "emp-10") employeeEvents.push({ id: `evt-${++eventSeq}`, employee_id: e.id, event_type: "promotion", effective_date: "2026-03-01", title: "Promoted to Marketing Executive", detail: "Brand and campaigns", amount: null, created_at: nowIso })
    if (e.id === "emp-17" || e.id === "emp-18") {
      employeeEvents.push({ id: `evt-${++eventSeq}`, employee_id: e.id, event_type: "status_change", effective_date: e.resigned_on, title: "Resigned", detail: "Offboarding completed", amount: null, created_at: nowIso })
    }
    if (idx === 0) employeeEvents.push({ id: `evt-${++eventSeq}`, employee_id: e.id, event_type: "note", effective_date: "2026-08-20", title: "Completed warehouse safety training", detail: "Valid for two years", amount: null, created_at: nowIso })
  })

  const jobs: Row[] = [
    { id: "job-1", title: "Sales Executive", department: "Sales", employment_type: "full_time", description: "Own the Yangon retail accounts.", status: "open", created_at: nowIso },
    { id: "job-2", title: "Junior Accountant", department: "Finance", employment_type: "full_time", description: "Support monthly closing and SSB filings.", status: "open", created_at: nowIso },
    { id: "job-3", title: "Senior Developer", department: "Engineering", employment_type: "full_time", description: "Lead the internal operations platform.", status: "open", created_at: nowIso },
    { id: "job-4", title: "HR Generalist", department: "HR", employment_type: "full_time", description: "Employee relations and policy support.", status: "closed", created_at: nowIso },
    { id: "job-5", title: "Warehouse Lead", department: "Warehouse", employment_type: "full_time", description: "Run the Yangon distribution floor.", status: "closed", created_at: nowIso },
  ]

  const applicantSeed: [string, string, string, number][] = [
    ["app-1", "job-1", "Htet Naing", 0,],
    ["app-2", "job-1", "Ei Phyu", 0,],
    ["app-3", "job-2", "Zaw Lin", 0,],
    ["app-4", "job-1", "Nay Chi", 1,],
    ["app-5", "job-1", "Soe Min", 2,],
    ["app-6", "job-1", "Thandar Htun", 3,],
    ["app-7", "job-2", "Yamin Aung", 1,],
    ["app-8", "job-2", "Phue Wai", 2,],
    ["app-9", "job-2", "Kyaw Htet", 3,],
    ["app-10", "job-3", "Aye Chan", 1,],
    ["app-11", "job-3", "Min Thu", 2,],
    ["app-12", "job-3", "Zin Ko", 4,],
    ["app-13", "job-4", "Swe Swe", 5,],
    ["app-14", "job-4", "Moe Moe", 3,],
    ["app-15", "job-5", "Tun Tun", 5,],
    ["app-16", "job-5", "Hla Hla", 1,],
  ]
  const stageFor = ["applied", "screening", "interview", "offer", "hired", "rejected"]
  const applicants: Row[] = applicantSeed.map(([id, jobId, name, stageIdx], idx) => ({
    id,
    job_id: jobId,
    name,
    email: `${String(name).toLowerCase().replace(/\s+/g, ".")}@example.com`,
    phone: `09 555 02${String(idx + 10).padStart(2, "0")}`,
    stage: stageFor[Number(stageIdx)],
    notes: Number(stageIdx) >= 2 ? "Shortlisted by hiring manager." : null,
    applied_on: shift(-(idx + 2)),
    created_at: nowIso,
  }))

  const vehicles: Row[] = [
    { id: "veh-1", plate_no: "YGN-1234", model: "Toyota Hilux", driver_name: "Aung Ko", status: "active", created_at: nowIso },
    { id: "veh-2", plate_no: "MDY-5678", model: "Suzuki Carry", driver_name: "Kyaw Zin", status: "maintenance", created_at: nowIso },
    { id: "veh-3", plate_no: "YGN-7788", model: "Toyota Hiace", driver_name: "Ko Ko", status: "active", created_at: nowIso },
    { id: "veh-4", plate_no: "YGN-4455", model: "Mitsubishi Fuso", driver_name: "Phyo Wai", status: "active", created_at: nowIso },
  ]

  const fuelLogs: Row[] = []
  let fuelSeq = 0
  vehicles.forEach((v, vidx) => {
    for (let i = 0; i < 6; i++) {
      const liters = 30 + ((vidx + i) % 5) * 8
      fuelLogs.push({
        id: `fuel-${++fuelSeq}`,
        vehicle_id: v.id,
        log_date: shift(-(i * 14 + vidx * 2)),
        liters,
        cost: liters * (2300 + vidx * 40),
        odometer: 30000 + vidx * 12000 + (6 - i) * 420,
        notes: i === 0 ? "Full tank" : null,
        created_at: nowIso,
      })
    }
  })

  const maintenance: Row[] = [
    { id: "maint-1", vehicle_id: "veh-1", service_date: shift(-30), description: "Engine oil and filter change", cost: 85000, odometer: 52000, next_due: shift(150), created_at: nowIso },
    { id: "maint-2", vehicle_id: "veh-2", service_date: shift(-12), description: "Brake pads and wheel alignment", cost: 140000, odometer: 31000, next_due: shift(170), created_at: nowIso },
    { id: "maint-3", vehicle_id: "veh-3", service_date: shift(-45), description: "Air conditioning service", cost: 120000, odometer: 41000, next_due: shift(135), created_at: nowIso },
    { id: "maint-4", vehicle_id: "veh-4", service_date: shift(-7), description: "Tyre replacement, rear axle", cost: 320000, odometer: 68000, next_due: shift(350), created_at: nowIso },
  ]

  const claims: Row[] = [
    { id: "claim-1", employee_id: "emp-3", claim_date: today, category: "travel", description: "Yangon to Mandalay bus fare", amount: 45000, status: "pending", created_at: nowIso },
    { id: "claim-2", employee_id: "emp-1", claim_date: today, category: "meals", description: "Team lunch for warehouse crew", amount: 82000, status: "approved", created_at: nowIso },
    { id: "claim-3", employee_id: "emp-4", claim_date: shift(-3), category: "supplies", description: "Printer toner and paper", amount: 135000, status: "reimbursed", created_at: nowIso },
    { id: "claim-4", employee_id: "emp-7", claim_date: shift(-7), category: "travel", description: "Client visit, Mandalay", amount: 210000, status: "approved", created_at: nowIso },
    { id: "claim-5", employee_id: "emp-5", claim_date: shift(-14), category: "supplies", description: "Developer conference materials", amount: 68000, status: "reimbursed", created_at: nowIso },
    { id: "claim-6", employee_id: "emp-10", claim_date: shift(-20), category: "meals", description: "Campaign launch lunch", amount: 96000, status: "rejected", created_at: nowIso },
    { id: "claim-7", employee_id: "emp-11", claim_date: shift(-25), category: "fuel", description: "Forklift diesel", amount: 180000, status: "approved", created_at: nowIso },
    { id: "claim-8", employee_id: "emp-12", claim_date: shift(-33), category: "travel", description: "Delivery route tolls", amount: 32000, status: "reimbursed", created_at: nowIso },
    { id: "claim-9", employee_id: "emp-15", claim_date: shift(-41), category: "travel", description: "Customer meeting, Naypyitaw", amount: 165000, status: "reimbursed", created_at: nowIso },
    { id: "claim-10", employee_id: "emp-14", claim_date: shift(-52), category: "other", description: "Recruitment event booth", amount: 250000, status: "approved", created_at: nowIso },
    { id: "claim-11", employee_id: "emp-16", claim_date: shift(-63), category: "supplies", description: "Filing folders", amount: 28000, status: "reimbursed", created_at: nowIso },
    { id: "claim-12", employee_id: "emp-9", claim_date: shift(-75), category: "meals", description: "Overtime dinner", amount: 54000, status: "reimbursed", created_at: nowIso },
  ]

  leaveRequests
    .filter((l) => l.status !== "pending")
    .slice(0, 5)
    .forEach((l) => {
      activities.push({
        id: `act-${++activitySeq}`,
        entity: "leave_request",
        entity_id: l.id,
        action: l.status,
        detail: `${l.leave_type} leave ${l.status}`,
        actor: "HR Admin",
        created_at: nowIso,
      })
    })
  claims
    .filter((c) => c.status === "approved")
    .slice(0, 3)
    .forEach((c) => {
      activities.push({
        id: `act-${++activitySeq}`,
        entity: "expense_claim",
        entity_id: c.id,
        action: "approved",
        detail: `${c.category} claim approved`,
        actor: "HR Admin",
        created_at: nowIso,
      })
    })
  employees.slice(0, 4).forEach((e) => {
    activities.push({
      id: `act-${++activitySeq}`,
      entity: "employee",
      entity_id: e.id,
      action: "updated",
      detail: `${e.name} profile updated`,
      actor: "HR Admin",
      created_at: nowIso,
    })
  })

  return {
    employees,
    attendance,
    payroll_runs: payrollRuns,
    payslips,
    app_settings: [{ id: 1, ...SETTINGS, updated_at: nowIso }],
    leave_requests: leaveRequests,
    leave_balances: leaveBalances,
    employee_documents: documents,
    employee_events: employeeEvents,
    activity_log: activities,
    tasks,
    job_posts: jobs,
    applicants,
    vehicles,
    fuel_logs: fuelLogs,
    vehicle_maintenance: maintenance,
    expense_claims: claims,
    email_templates: [
      {
        id: "tmpl-1",
        name: "Payslip notification",
        subject: "Your {{period}} payslip - {{company}}",
        body: "Hi {{name}},\n\nYour {{period}} payslip is ready.\nNet pay: {{net}}\n\nRegards,\n{{company}} HR",
        updated_at: nowIso,
      },
      {
        id: "tmpl-2",
        name: "Interview invitation",
        subject: "Interview invitation - {{company}}",
        body: "Hi {{name}},\n\nWe would like to invite you for an interview. Please reply with a time that works for you.\n\nRegards,\n{{company}} HR",
        updated_at: nowIso,
      },
      {
        id: "tmpl-3",
        name: "Offer letter follow-up",
        subject: "Your offer from {{company}}",
        body: "Hi {{name}},\n\nWe are pleased to move forward. Please review the attached offer and confirm your start date.\n\nRegards,\n{{company}} HR",
        updated_at: nowIso,
      },
    ],
  }
}


// Column defaults the app relies on when an insert omits them (mirrors the SQL schema).
const DEFAULTS: Record<string, Row> = {
  employees: { status: "active", employment_type: "full_time", department: "General", position: "Staff", base_salary: 0, ot_eligible: true },
  payroll_runs: { status: "draft", finalized_at: null },
  leave_requests: { status: "pending", leave_type: "annual" },
  tasks: { status: "todo", priority: "normal" },
  job_posts: { status: "open", department: "General", employment_type: "full_time" },
  applicants: { stage: "applied", employee_id: null },
  vehicles: { status: "active" },
  fuel_logs: { liters: 0, cost: 0 },
  expense_claims: { status: "pending", category: "other", amount: 0 },
  employee_events: { event_type: "note" },
  employee_documents: { doc_type: "other" },
  leave_balances: { entitled_days: 0, used_days: 0 },
  vehicle_maintenance: { cost: 0 },
  activity_log: { actor: "HR Admin" },
}

let memoryStore: StorageLike | null = null

function getStorage(): StorageLike | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage
  } catch {
    // private mode / blocked storage
  }
  return memoryStore
}

function load(store: StorageLike | null): Tables {
  const raw = store?.getItem(LOCAL_DB_KEY)
  if (raw) {
    try {
      return JSON.parse(raw) as Tables
    } catch {
      // corrupted demo data -> reseed
    }
  }
  const fresh = seed()
  store?.setItem(LOCAL_DB_KEY, JSON.stringify(fresh))
  return fresh
}

function save(store: StorageLike | null, db: Tables) {
  store?.setItem(LOCAL_DB_KEY, JSON.stringify(db))
}

type Filter =
  | { column: string; kind: "eq"; value: unknown }
  | { column: string; kind: "in"; value: unknown[] }
  | { column: string; kind: "gte"; value: unknown }
  | { column: string; kind: "lte"; value: unknown }

type Order = { column: string; ascending: boolean }

type LocalResult = {
  data: any
  error: { message: string } | null
  count: number | null
}

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((f) => {
    const v = row[f.column]
    switch (f.kind) {
      case "eq":
        return v === f.value
      case "in":
        return f.value.includes(v)
      case "gte":
        return String(v ?? "") >= String(f.value ?? "")
      case "lte":
        return String(v ?? "") <= String(f.value ?? "")
    }
  })
}

function pick(row: Row, columns: string[]): Row {
  if (columns.length === 0 || columns.includes("*")) return { ...row }
  const out: Row = {}
  for (const c of columns) out[c] = row[c]
  return out
}

class LocalQuery {
  private table: string
  private store: StorageLike | null
  private action: "select" | "insert" | "update" | "delete" | "upsert" = "select"
  private payload: Row | Row[] | null = null
  private upsertOptions: { onConflict?: string } = {}
  private columns = "*"
  private countRequested = false
  private head = false
  private filters: Filter[] = []
  private orders: Order[] = []
  private max: number | null = null

  constructor(table: string, store: StorageLike | null) {
    this.table = table
    this.store = store
  }

  select(columns = "*", options?: { count?: "exact"; head?: boolean }) {
    this.columns = columns
    this.countRequested = options?.count === "exact"
    this.head = options?.head === true
    return this
  }

  insert(payload: Row | Row[]) {
    this.action = "insert"
    this.payload = payload
    return this
  }

  update(payload: Row) {
    this.action = "update"
    this.payload = payload
    return this
  }

  upsert(payload: Row | Row[], options?: { onConflict?: string }) {
    this.action = "upsert"
    this.payload = payload
    this.upsertOptions = options ?? {}
    return this
  }

  delete() {
    this.action = "delete"
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, kind: "eq", value })
    return this
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ column, kind: "in", value })
    return this
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, kind: "gte", value })
    return this
  }

  lte(column: string, value: unknown) {
    this.filters.push({ column, kind: "lte", value })
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending !== false })
    return this
  }

  limit(n: number) {
    this.max = n
    return this
  }

  single() {
    return this.then((r) => ({ ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data }))
  }

  maybeSingle() {
    return this.single()
  }

  then<R1 = LocalResult, R2 = never>(
    onfulfilled?: ((value: LocalResult) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected)
  }

  private run(): LocalResult {
    try {
      const db = load(this.store)
      const rows = db[this.table] ?? (db[this.table] = [])
      const now = new Date().toISOString()

      if (this.action === "insert") {
        const incoming = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}]
        const inserted = incoming.map((r) => {
          const row: Row = { ...(DEFAULTS[this.table] ?? {}), id: newId(), created_at: now, ...r }
          rows.push(row)
          return row
        })
        save(this.store, db)
        return { data: inserted, error: null, count: null }
      }

      if (this.action === "update") {
        const patch = (this.payload ?? {}) as Row
        const updated: Row[] = []
        db[this.table] = rows.map((r) => {
          if (!matches(r, this.filters)) return r
          const next = { ...r, ...patch }
          updated.push(next)
          return next
        })
        save(this.store, db)
        return { data: updated, error: null, count: null }
      }

      if (this.action === "delete") {
        const removed: Row[] = []
        db[this.table] = rows.filter((r) => {
          if (!matches(r, this.filters)) return true
          removed.push(r)
          return false
        })
        save(this.store, db)
        return { data: removed, error: null, count: null }
      }

      if (this.action === "upsert") {
        const incoming = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}]
        const keys = this.upsertOptions.onConflict
          ? this.upsertOptions.onConflict.split(",").map((k) => k.trim())
          : ["id"]
        const saved: Row[] = []
        for (const r of incoming) {
          const idx = rows.findIndex((existing) => keys.every((k) => r[k] !== undefined && existing[k] === r[k]))
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...r }
            saved.push(rows[idx]!)
          } else {
            const row: Row = { ...(DEFAULTS[this.table] ?? {}), id: newId(), created_at: now, ...r }
            rows.push(row)
            saved.push(row)
          }
        }
        save(this.store, db)
        return { data: saved, error: null, count: null }
      }

      let result = rows.filter((r) => matches(r, this.filters))
      const count = this.countRequested ? result.length : null
      if (this.head) return { data: null, error: null, count }

      for (const o of [...this.orders].reverse()) {
        result = [...result].sort((a, b) => {
          const av = a[o.column]
          const bv = b[o.column]
          if (av === bv) return 0
          if (av === null || av === undefined) return 1
          if (bv === null || bv === undefined) return -1
          const cmp = av < bv ? -1 : 1
          return o.ascending ? cmp : -cmp
        })
      }
      if (this.max !== null) result = result.slice(0, this.max)

      const embeds = [...this.columns.matchAll(/(\w+)\s*\(([^)]*)\)/g)].map((m) => ({
        name: m[1] ?? "",
        columns: (m[2] ?? "").split(",").map((c) => c.trim()).filter(Boolean),
      }))
      const simple = this.columns
        .replace(/\w+\s*\([^)]*\)/g, "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)

      const data = result.map((row) => {
        const out = pick(row, simple)
        for (const embed of embeds) {
          // Only relation used by the app so far: payroll_runs -> payslips
          if (this.table === "payroll_runs" && embed.name === "payslips") {
            out.payslips = (db.payslips ?? [])
              .filter((p) => p.run_id === row.id)
              .map((p) => pick(p, embed.columns))
          }
        }
        return out
      })

      return { data, error: null, count }
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) }, count: null }
    }
  }
}

export function createLocalClient(storage?: StorageLike) {
  const store = storage ?? getStorage()
  if (!store && !memoryStore) memoryStore = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  const resolved = store ?? memoryStore
  return {
    from: (table: string) => new LocalQuery(table, resolved),
  }
}

export function resetLocalDb() {
  const store = getStorage()
  store?.removeItem(LOCAL_DB_KEY)
  store?.removeItem("hr-local-db-v1")
  load(store)
}
