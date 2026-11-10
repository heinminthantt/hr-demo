import { monthNames, todayStr } from "./format"

export const DEFAULT_LEAVE_ENTITLEMENTS: Record<string, number> = {
  annual: 14,
  sick: 7,
  unpaid: 0,
  other: 3,
}

export type EmployeeEventRow = {
  id: string
  employee_id: string
  event_type: string
  effective_date: string
  title: string
  detail: string | null
  amount: number | null
  created_at: string
}

export type LeaveBalanceRow = {
  id: string
  employee_id: string
  leave_type: string
  year: number
  entitled_days: number
  used_days: number
  created_at: string
}

export type EmployeeDocumentRow = {
  id: string
  employee_id: string
  name: string
  doc_type: string
  issued_on: string | null
  expires_on: string | null
  reference: string | null
  file_url: string | null
  notes: string | null
  created_at: string
}

export type ActivityRow = {
  id: string
  entity: string
  entity_id: string | null
  action: string
  detail: string | null
  actor: string
  created_at: string
}

export type LeaveRequestRow = {
  id: string
  employee_id: string
  leave_type: string
  start_date: string
  end_date: string
  days: number
  reason: string | null
  status: string
  created_at: string
}

export type TaskRow = {
  id: string
  title: string
  assignee_id: string | null
  due_date: string | null
  priority: string
  status: string
  notes: string | null
  created_at: string
}

export type ExpenseClaimRow = {
  id: string
  employee_id: string
  claim_date: string
  category: string
  description: string | null
  amount: number
  status: string
  created_at: string
}

export type JobPostRow = {
  id: string
  title: string
  department: string
  employment_type: string
  description: string | null
  status: string
  created_at: string
}

export type ApplicantRow = {
  id: string
  job_id: string | null
  name: string
  email: string | null
  phone: string | null
  stage: string
  notes: string | null
  applied_on: string
  created_at: string
}

export type VehicleRow = {
  id: string
  plate_no: string
  model: string | null
  driver_name: string | null
  status: string
  created_at: string
}

export type FuelLogRow = {
  id: string
  vehicle_id: string
  log_date: string
  liters: number
  cost: number
  odometer: number | null
  notes: string | null
  created_at: string
}

export type VehicleMaintenanceRow = {
  id: string
  vehicle_id: string
  service_date: string
  description: string
  cost: number
  odometer: number | null
  next_due: string | null
  created_at: string
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase() || "?"
}

export function tenureLabel(joinDate: string, endDate?: string | null): string {
  const start = new Date(`${joinDate}T00:00:00`)
  const end = new Date(`${endDate ?? todayStr()}T00:00:00`)
  if (Number.isNaN(start.getTime()) || end < start) return "New"
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) months--
  if (months < 1) return "New"
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return `${rest} mo`
  return rest === 0 ? `${years} yr` : `${years} yr ${rest} mo`
}

export function daysUntil(date: string | null): number | null {
  if (!date) return null
  const target = new Date(`${date}T00:00:00`)
  const start = new Date(`${todayStr()}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  return Math.round((target.getTime() - start.getTime()) / 86400000)
}

export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`
}

export function monthLabel(year: number, month: number): string {
  return `${monthNames[month - 1] ?? ""} ${year}`.trim()
}

export function recentMonths(count: number, from = new Date()): { year: number; month: number; key: string; label: string }[] {
  const out: { year: number; month: number; key: string; label: string }[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1)
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1, key: monthKey(d.getFullYear(), d.getMonth() + 1), label: monthLabel(d.getFullYear(), d.getMonth() + 1) })
  }
  return out
}

export function leaveUsed(requests: LeaveRequestRow[], employeeId: string, type: string, year: number): number {
  return requests
    .filter(
      (r) =>
        r.employee_id === employeeId &&
        r.leave_type === type &&
        r.status === "approved" &&
        Number(r.start_date.slice(0, 4)) === year
    )
    .reduce((s, r) => s + Number(r.days || 0), 0)
}

export function documentState(doc: EmployeeDocumentRow): { label: string; tone: "ok" | "soon" | "expired" } {
  const days = daysUntil(doc.expires_on)
  if (days === null) return { label: "No expiry", tone: "ok" }
  if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, tone: "expired" }
  if (days <= 60) return { label: `Expires in ${days}d`, tone: "soon" }
  return { label: "Valid", tone: "ok" }
}
