"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CrudTable, type CrudOption, type CrudRow } from "@/components/crud-table"
import { PageHeader } from "@/components/page-header"
import { ChartCard, DonutChart, TrendChart } from "@/components/charts"
import { supabase } from "@/lib/supabase"
import type { EmployeeRow } from "@/lib/payroll"
import { fmtDate, todayStr } from "@/lib/format"
import { recentMonths } from "@/lib/hr"
import { adjustLeaveBalance } from "@/lib/leave"
import { logActivity } from "@/lib/activity"

type LeaveRow = { id: string; employee_id: string; leave_type: string; start_date: string; days: number; status: string }

const LEAVE_COLORS: Record<string, string> = { annual: "#0ea5e9", sick: "#ef4444", unpaid: "#f59e0b", other: "#8b5cf6" }
const sumDays = (rows: LeaveRow[]) => rows.reduce((s, r) => s + Number(r.days || 0), 0)

const LEAVE_TYPES: CrudOption[] = [
  { value: "annual", label: "Annual leave" },
  { value: "sick", label: "Sick leave" },
  { value: "unpaid", label: "Unpaid leave" },
  { value: "other", label: "Other" },
]

const STATUSES: CrudOption[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
]

export default function FormsPage() {
  const [employees, setEmployees] = useState<Pick<EmployeeRow, "id" | "name" | "employee_code">[]>([])
  const [requests, setRequests] = useState<LeaveRow[]>([])
  const year = new Date().getFullYear()

  const loadEmployees = useCallback(async () => {
    const [{ data: emps }, { data: leaveRows }] = await Promise.all([
      supabase.from("employees").select("id, name, employee_code").eq("status", "active").order("employee_code"),
      supabase.from("leave_requests").select("id, employee_id, leave_type, start_date, days, status").order("start_date", { ascending: false }),
    ])
    setEmployees((emps as Pick<EmployeeRow, "id" | "name" | "employee_code">[]) ?? [])
    setRequests((leaveRows as LeaveRow[]) ?? [])
  }, [])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])
  const empOptions = employees.map((e) => ({ value: e.id, label: `${e.employee_code} - ${e.name}` }))
  const nameOf = (id: string) => byId.get(id)?.name ?? "(deleted)"

  const pending = requests.filter((r) => r.status === "pending")
  const approved = requests.filter((r) => r.status === "approved")
  const thisYear = approved.filter((r) => r.start_date.startsWith(String(year)))
  const typeMix = LEAVE_TYPES.map((t) => ({
    name: t.label.replace(" leave", ""),
    value: sumDays(approved.filter((r) => r.leave_type === t.value)),
    color: LEAVE_COLORS[t.value],
  })).filter((d) => d.value > 0)
  const monthly = recentMonths(6).map(({ label, key }) => ({
    month: label.slice(0, 3),
    days: sumDays(approved.filter((r) => r.start_date.startsWith(key))),
  }))

  const applyLeaveChange = async (next: CrudRow, previous: CrudRow | null) => {
    const wasApproved = previous?.status === "approved"
    const isApproved = next.status === "approved"
    const changed =
      !previous ||
      wasApproved !== isApproved ||
      previous.employee_id !== next.employee_id ||
      previous.leave_type !== next.leave_type ||
      previous.start_date !== next.start_date ||
      Number(previous.days) !== Number(next.days)
    if (!changed) return

    if (wasApproved && previous) {
      await adjustLeaveBalance({
        employeeId: String(previous.employee_id),
        leaveType: String(previous.leave_type),
        startDate: String(previous.start_date),
        days: -Number(previous.days),
      })
    }
    if (isApproved) {
      await adjustLeaveBalance({
        employeeId: String(next.employee_id),
        leaveType: String(next.leave_type),
        startDate: String(next.start_date),
        days: Number(next.days),
      })
    }

    const action = previous ? (previous.status !== next.status ? String(next.status) : "updated") : "created"
    await logActivity(
      "leave_request",
      String(next.id),
      action,
      `${nameOf(String(next.employee_id))}: ${Number(next.days)} day(s) ${String(next.leave_type)} leave ${next.status}`
    )
  }

  const decide = async (row: CrudRow, status: string, reload: () => Promise<void>) => {
    const { error } = await supabase.from("leave_requests").update({ status }).eq("id", row.id)
    if (!error) {
      await applyLeaveChange({ ...row, status }, row)
      await reload()
      await loadEmployees()
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Forms"
        description="Leave requests, approvals and time off analytics."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pending approval" value={String(pending.length)} hint={`${sumDays(pending)} day(s) requested`} />
        <Stat label={`${year} approved leave`} value={`${sumDays(thisYear)} day(s)`} hint={`${thisYear.length} request(s)`} />
        <Stat label="Sick leave this year" value={`${sumDays(thisYear.filter((r) => r.leave_type === "sick"))} day(s)`} hint="approved sick leave" />
        <Stat label="Annual leave this year" value={`${sumDays(thisYear.filter((r) => r.leave_type === "annual"))} day(s)`} hint="approved annual leave" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Approved leave by type" description="Days approved across all recorded leave requests.">
          <DonutChart data={typeMix} centerValue={`${sumDays(approved)}`} centerLabel="days approved" formatValue={(n) => `${n} day(s)`} height={220} />
        </ChartCard>
        <ChartCard title="Leave days per month" description="Approved leave days over the last six months.">
          <TrendChart data={monthly} xKey="month" series={[{ key: "days", label: "Leave days", color: "var(--chart-2)" }]} formatAxis={(n) => String(n)} height={220} />
        </ChartCard>
      </div>

      <CrudTable
        title="Leave requests"
        table="leave_requests"
        addLabel="+ New request"
        onChanged={loadEmployees}
        onSaved={applyLeaveChange}
        fields={[
          { key: "employee_id", label: "Employee", type: "select", optionsKey: "employee", required: true },
          { key: "leave_type", label: "Leave type", type: "select", optionsKey: "leaveType", defaultValue: "annual" },
          { key: "start_date", label: "Start date", type: "date", required: true, defaultValue: todayStr() },
          { key: "end_date", label: "End date", type: "date", required: true, defaultValue: todayStr() },
          { key: "days", label: "Days", type: "number", defaultValue: 1 },
          { key: "status", label: "Status", type: "select", optionsKey: "status", defaultValue: "pending" },
          { key: "reason", label: "Reason", type: "textarea" },
        ]}
        options={{ employee: empOptions, leaveType: LEAVE_TYPES, status: STATUSES }}
        searchKeys={["reason"]}
        columns={[
          { key: "employee_id", label: "Employee", render: (r) => nameOf(r.employee_id) },
          {
            key: "leave_type",
            label: "Type",
            render: (r) => LEAVE_TYPES.find((t) => t.value === r.leave_type)?.label ?? r.leave_type,
          },
          {
            key: "start_date",
            label: "Dates",
            render: (r) => `${fmtDate(r.start_date)} to ${fmtDate(r.end_date)}`,
          },
          { key: "days", label: "Days", align: "right", render: (r) => Number(r.days) },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <Badge variant={r.status === "approved" ? "default" : "secondary"}>{r.status}</Badge>
            ),
          },
          { key: "reason", label: "Reason" },
        ]}
        rowActions={(row, reload) =>
          row.status === "pending" ? (
            <>
              <Button variant="secondary" size="xs" onClick={() => decide(row, "approved", reload)}>
                Approve
              </Button>
              <Button variant="ghost" size="xs" onClick={() => decide(row, "rejected", reload)}>
                Reject
              </Button>
            </>
          ) : null
        }
      />
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">{hint}</p>
      </CardContent>
    </Card>
  )
}
