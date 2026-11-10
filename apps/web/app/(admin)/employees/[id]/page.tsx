"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  RiAddLine,
  RiArrowRightSLine,
  RiBankCardLine,
  RiBriefcaseLine,
  RiCalendarLine,
  RiFileTextLine,
  RiMailLine,
  RiMapPinLine,
  RiPhoneLine,
  RiTimeLine,
} from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { PageHeader } from "@/components/page-header"
import { SegmentedTabs } from "@/components/segmented-tabs"
import { StatusBadge } from "@/components/status-badge"
import { ChartCard, DonutChart, HorizontalBars, TrendChart } from "@/components/charts"
import { supabase } from "@/lib/supabase"
import type { AppSettingsRow, AttendanceRow, EmployeeRow, PayrollRunRow, PayslipRow } from "@/lib/payroll"
import { WORKDAY_WEIGHTS, otHoursFrom, workDaysFrom } from "@/lib/payroll"
import { fmtDate, money, todayStr } from "@/lib/format"
import {
  documentState,
  initials,
  leaveUsed,
  monthLabel,
  pct,
  tenureLabel,
  type ActivityRow,
  type EmployeeDocumentRow,
  type EmployeeEventRow,
  type ExpenseClaimRow,
  type LeaveBalanceRow,
  type LeaveRequestRow,
  type TaskRow,
} from "@/lib/hr"

type Tab = "overview" | "attendance" | "leave" | "payroll" | "documents" | "activity"

const TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "attendance", label: "Attendance" },
  { value: "leave", label: "Leave" },
  { value: "payroll", label: "Payroll" },
  { value: "documents", label: "Documents" },
  { value: "activity", label: "Activity" },
]

const LEAVE_TYPES = ["annual", "sick", "unpaid", "other"]
const DOC_TYPES = ["contract", "id", "licence", "certificate", "other"]

const shift = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString("en-CA")
}

const label = (s: string) => s.replaceAll("_", " ")

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>()
  const id = String(params.id)
  const year = new Date().getFullYear()
  const [tab, setTab] = useState<Tab>("overview")
  const [employee, setEmployee] = useState<EmployeeRow | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [leave, setLeave] = useState<LeaveRequestRow[]>([])
  const [balances, setBalances] = useState<LeaveBalanceRow[]>([])
  const [payslips, setPayslips] = useState<PayslipRow[]>([])
  const [runs, setRuns] = useState<PayrollRunRow[]>([])
  const [claims, setClaims] = useState<ExpenseClaimRow[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [documents, setDocuments] = useState<EmployeeDocumentRow[]>([])
  const [events, setEvents] = useState<EmployeeEventRow[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [settings, setSettings] = useState<AppSettingsRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState("")

  const [editOpen, setEditOpen] = useState(false)
  const [salaryOpen, setSalaryOpen] = useState(false)
  const [docOpen, setDocOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState("")

  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    nrc_no: "",
    department: "",
    position: "",
    employment_type: "full_time",
    status: "active",
    resigned_on: "",
  })
  const [salaryForm, setSalaryForm] = useState({ amount: "", effective_date: todayStr(), reason: "" })
  const [docForm, setDocForm] = useState({
    name: "",
    doc_type: "other",
    issued_on: todayStr(),
    expires_on: "",
    reference: "",
    file_url: "",
    notes: "",
  })
  const [noteForm, setNoteForm] = useState({ title: "", detail: "", effective_date: todayStr() })

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    const [
      { data: emp, error: empErr },
      { data: att },
      { data: leaveRows },
      { data: balanceRows },
      { data: slipRows },
      { data: runRows },
      { data: claimRows },
      { data: taskRows },
      { data: docRows },
      { data: eventRows },
      { data: activityRows },
      { data: s },
    ] = await Promise.all([
      supabase.from("employees").select("*").eq("id", id).maybeSingle(),
      supabase.from("attendance").select("*").eq("employee_id", id).gte("work_date", shift(-120)).order("work_date", { ascending: false }),
      supabase.from("leave_requests").select("*").eq("employee_id", id).order("start_date", { ascending: false }),
      supabase.from("leave_balances").select("*").eq("employee_id", id).eq("year", year),
      supabase.from("payslips").select("*").eq("employee_id", id).order("created_at", { ascending: false }),
      supabase.from("payroll_runs").select("*").order("period_year", { ascending: false }).order("period_month", { ascending: false }),
      supabase.from("expense_claims").select("*").eq("employee_id", id).order("claim_date", { ascending: false }),
      supabase.from("tasks").select("*").eq("assignee_id", id).order("due_date", { ascending: true }),
      supabase.from("employee_documents").select("*").eq("employee_id", id).order("created_at", { ascending: false }),
      supabase.from("employee_events").select("*").eq("employee_id", id).order("effective_date", { ascending: false }),
      supabase.from("activity_log").select("*").eq("entity", "employee").eq("entity_id", id).order("created_at", { ascending: false }).limit(30),
      supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    ])
    if (empErr) setError(empErr.message)
    if (!emp) {
      setNotFound(true)
      setLoading(false)
      return
    }
    const person = emp as EmployeeRow
    setEmployee(person)
    setAttendance((att as AttendanceRow[]) ?? [])
    setLeave((leaveRows as LeaveRequestRow[]) ?? [])
    setBalances((balanceRows as LeaveBalanceRow[]) ?? [])
    setPayslips((slipRows as PayslipRow[]) ?? [])
    setRuns((runRows as PayrollRunRow[]) ?? [])
    setClaims((claimRows as ExpenseClaimRow[]) ?? [])
    setTasks((taskRows as TaskRow[]) ?? [])
    setDocuments((docRows as EmployeeDocumentRow[]) ?? [])
    setEvents((eventRows as EmployeeEventRow[]) ?? [])
    setActivity((activityRows as ActivityRow[]) ?? [])
    setSettings((s as AppSettingsRow) ?? null)
    setLoading(false)
  }, [id, year])

  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [load])

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab")
    if (requested && TABS.some((t) => t.value === requested)) setTab(requested as Tab)
  }, [])

  const cur = settings?.currency ?? "MMK"
  const runById = useMemo(() => new Map(runs.map((r) => [r.id, r])), [runs])

  const attendanceSummary = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of attendance) counts.set(a.status, (counts.get(a.status) ?? 0) + 1)
    return {
      present: counts.get("present") ?? 0,
      half: counts.get("half_day") ?? 0,
      leave: counts.get("leave") ?? 0,
      absent: counts.get("absent") ?? 0,
      ot: otHoursFrom(attendance),
      credit: workDaysFrom(attendance),
    }
  }, [attendance])

  const attendanceMix = useMemo(
    () =>
      [
        { name: "present", value: attendanceSummary.present, color: "#10b981" },
        { name: "half_day", value: attendanceSummary.half, color: "#f59e0b" },
        { name: "leave", value: attendanceSummary.leave, color: "#0ea5e9" },
        { name: "absent", value: attendanceSummary.absent, color: "#ef4444" },
      ].filter((d) => d.value > 0),
    [attendanceSummary]
  )

  const balancesView = useMemo(() => {
    const defaults: Record<string, number> = { annual: 14, sick: 7, unpaid: 0, other: 3 }
    return LEAVE_TYPES.map((type) => {
      const row = balances.find((b) => b.leave_type === type)
      const entitled = row ? Number(row.entitled_days) : defaults[type] ?? 0
      const used = row ? Number(row.used_days) : leaveUsed(leave, id, type, year)
      return { type, entitled, used, remaining: Math.max(0, entitled - used) }
    })
  }, [balances, leave, id, year])

  const ytd = useMemo(() => {
    const finalized = payslips.filter((p) => {
      const run = runById.get(p.run_id)
      return run?.status === "finalized" && run.period_year === year
    })
    const gross = finalized.reduce(
      (s, p) => s + Number(p.basic_amount) + Number(p.ot_amount) + Number(p.allowance) + Number(p.other_bonus),
      0
    )
    const deductions = finalized.reduce(
      (s, p) => s + Number(p.ssb_employee) + Number(p.pit) + Number(p.absence_deduction) + Number(p.other_deduction),
      0
    )
    const net = finalized.reduce((s, p) => s + Number(p.net_pay), 0)
    const employerSsb = finalized.reduce((s, p) => s + Number(p.ssb_employer), 0)
    return { gross, deductions, net, employerSsb, count: finalized.length }
  }, [payslips, runById, year])

  const salaryHistory = useMemo(() => {
    const rows = events
      .filter((e) => (e.event_type === "hired" || e.event_type === "salary_change") && Number(e.amount) > 0)
      .slice()
      .sort((a, b) => a.effective_date.localeCompare(b.effective_date))
      .map((e) => ({ date: fmtDate(e.effective_date).slice(0, 7), salary: Number(e.amount), title: e.title }))
    if (rows.length === 0 && employee) return [{ date: fmtDate(employee.join_date).slice(0, 7), salary: Number(employee.base_salary), title: "Joined" }, { date: fmtDate(todayStr()).slice(0, 7), salary: Number(employee.base_salary), title: "Current" }]
    if (employee && rows.length === 1) rows.push({ date: fmtDate(todayStr()).slice(0, 7), salary: Number(employee.base_salary), title: "Current" })
    return rows
  }, [events, employee])

  const payslipTrend = useMemo(
    () =>
      payslips
        .map((p) => {
          const run = runById.get(p.run_id)
          return run ? { month: `${monthLabel(run.period_year, run.period_month).slice(0, 3)} ${String(run.period_year).slice(2)}`, net: Number(p.net_pay), ts: `${run.period_year}-${String(run.period_month).padStart(2, "0")}` } : null
        })
        .filter((p): p is { month: string; net: number; ts: string } => p !== null)
        .sort((a, b) => a.ts.localeCompare(b.ts))
        .slice(-8),
    [payslips, runById]
  )

  const attendanceTrend = useMemo(
    () =>
      attendance
        .slice(0, 14)
        .reverse()
        .map((a) => ({ date: a.work_date.slice(5), credit: WORKDAY_WEIGHTS[a.status] ?? 0, ot: Number(a.ot_hours || 0) })),
    [attendance]
  )

  const expiringDocs = documents.filter((d) => {
    const state = documentState(d)
    return state.tone === "soon" || state.tone === "expired"
  })

  const openEdit = () => {
    if (!employee) return
    setEditForm({
      name: employee.name,
      phone: employee.phone ?? "",
      email: employee.email ?? "",
      address: employee.address ?? "",
      nrc_no: employee.nrc_no ?? "",
      department: employee.department,
      position: employee.position,
      employment_type: employee.employment_type,
      status: employee.status,
      resigned_on: employee.resigned_on ?? "",
    })
    setDialogError("")
    setEditOpen(true)
  }

  const openSalary = () => {
    setSalaryForm({ amount: String(employee?.base_salary ?? 0), effective_date: todayStr(), reason: "" })
    setDialogError("")
    setSalaryOpen(true)
  }

  const openDoc = () => {
    setDocForm({ name: "", doc_type: "other", issued_on: todayStr(), expires_on: "", reference: "", file_url: "", notes: "" })
    setDialogError("")
    setDocOpen(true)
  }

  const openNote = () => {
    setNoteForm({ title: "", detail: "", effective_date: todayStr() })
    setDialogError("")
    setNoteOpen(true)
  }

  const log = async (action: string, detail: string) => {
    await supabase.from("activity_log").insert({ entity: "employee", entity_id: id, action, detail })
  }

  const saveProfile = async () => {
    if (!employee || !editForm.name.trim()) {
      setDialogError("Name is required.")
      return
    }
    setBusy(true)
    setDialogError("")
    const res = await supabase
      .from("employees")
      .update({
        name: editForm.name.trim(),
        phone: editForm.phone || null,
        email: editForm.email || null,
        address: editForm.address || null,
        nrc_no: editForm.nrc_no || null,
        department: editForm.department || "General",
        position: editForm.position || "Staff",
        employment_type: editForm.employment_type,
        status: editForm.status,
        resigned_on: editForm.status === "resigned" ? editForm.resigned_on || todayStr() : null,
      })
      .eq("id", employee.id)
    if (res.error) {
      setBusy(false)
      setDialogError(res.error.message)
      return
    }
    if (employee.status !== editForm.status) {
      await supabase.from("employee_events").insert({
        employee_id: employee.id,
        event_type: "status_change",
        effective_date: editForm.status === "resigned" ? editForm.resigned_on || todayStr() : todayStr(),
        title: editForm.status === "resigned" ? "Resigned" : "Re-activated",
        detail: null,
        amount: null,
      })
    }
    await log("updated", `${editForm.name.trim()} profile updated`)
    setBusy(false)
    setEditOpen(false)
    await load()
  }

  const saveSalary = async () => {
    if (!employee) return
    const amount = Number(salaryForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setDialogError("Enter a valid monthly salary.")
      return
    }
    setBusy(true)
    setDialogError("")
    const res = await supabase.from("employees").update({ base_salary: amount }).eq("id", employee.id)
    if (res.error) {
      setBusy(false)
      setDialogError(res.error.message)
      return
    }
    await supabase.from("employee_events").insert({
      employee_id: employee.id,
      event_type: "salary_change",
      effective_date: salaryForm.effective_date,
      title: "Salary changed",
      detail: salaryForm.reason || null,
      amount,
    })
    await log("updated", `${employee.name} salary set to ${money(amount, cur)}`)
    setBusy(false)
    setSalaryOpen(false)
    await load()
  }

  const saveDocument = async () => {
    if (!employee || !docForm.name.trim()) {
      setDialogError("Document name is required.")
      return
    }
    setBusy(true)
    setDialogError("")
    const res = await supabase.from("employee_documents").insert({
      employee_id: employee.id,
      name: docForm.name.trim(),
      doc_type: docForm.doc_type,
      issued_on: docForm.issued_on || null,
      expires_on: docForm.expires_on || null,
      reference: docForm.reference || null,
      file_url: docForm.file_url || null,
      notes: docForm.notes || null,
    })
    if (res.error) {
      setBusy(false)
      setDialogError(res.error.message)
      return
    }
    await log("document_added", `${docForm.name.trim()} added to ${employee.name}`)
    setBusy(false)
    setDocOpen(false)
    await load()
    setTab("documents")
  }

  const saveNote = async () => {
    if (!employee || !noteForm.title.trim()) {
      setDialogError("Note title is required.")
      return
    }
    setBusy(true)
    setDialogError("")
    const res = await supabase.from("employee_events").insert({
      employee_id: employee.id,
      event_type: "note",
      effective_date: noteForm.effective_date,
      title: noteForm.title.trim(),
      detail: noteForm.detail || null,
      amount: null,
    })
    if (res.error) {
      setBusy(false)
      setDialogError(res.error.message)
      return
    }
    await log("note_added", `${noteForm.title.trim()} note added`)
    setBusy(false)
    setNoteOpen(false)
    await load()
  }

  if (loading) return <p className="text-muted-foreground p-6 text-sm">Loading employee...</p>
  if (notFound || !employee) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm">This employee could not be found.</p>
        <Button variant="outline" nativeButton={false} render={<Link href="/employees" />}>
          Back to employees
        </Button>
      </div>
    )
  }

  const annual = balancesView.find((b) => b.type === "annual")
  const countryCode = employee.employee_code

  return (
    <div className="space-y-5">
      <PageHeader
        backHref="/employees"
        backLabel="Employees"
        leading={
          <span className="from-primary/25 to-primary/5 text-primary ring-primary/15 flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-lg font-semibold ring-1">
            {initials(employee.name)}
          </span>
        }
        title={employee.name}
        meta={<StatusBadge status={employee.status} />}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs">{countryCode}</span>
            <span>·</span>
            <span>{employee.position}</span>
            <span>·</span>
            <span>{employee.department}</span>
            <span>·</span>
            <span>Joined {fmtDate(employee.join_date)}</span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={openEdit}>
              Edit profile
            </Button>
            <Button onClick={openSalary}>Change salary</Button>
          </>
        }
      />

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={RiBriefcaseLine} label="Tenure" value={tenureLabel(employee.join_date, employee.resigned_on)} hint={employee.employment_type.replaceAll("_", " ")} />
        <StatTile icon={RiBankCardLine} label="Monthly basic" value={money(Number(employee.base_salary), cur)} hint={employee.ot_eligible ? "OT eligible" : "Not OT eligible"} />
        <StatTile icon={RiCalendarLine} label="Annual leave left" value={`${annual?.remaining ?? 0} day(s)`} hint={`${annual?.used ?? 0} of ${annual?.entitled ?? 0} used`} />
        <StatTile icon={RiFileTextLine} label={`${year} net pay`} value={money(ytd.net, cur)} hint={`${ytd.count} finalized payslip(s)`} />
      </div>

      <SegmentedTabs tabs={TABS.map((t) => ({ ...t, count: t.value === "documents" ? documents.length : t.value === "activity" ? events.length : undefined }))} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Contact and employment details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailRow icon={RiMailLine} label="Email" value={employee.email ?? "-"} />
              <DetailRow icon={RiPhoneLine} label="Phone" value={employee.phone ?? "-"} />
              <DetailRow icon={RiMapPinLine} label="Address" value={employee.address ?? "-"} />
              <DetailRow icon={RiFileTextLine} label="NRC" value={employee.nrc_no ?? "-"} />
              <DetailRow icon={RiBriefcaseLine} label="Employment" value={label(employee.employment_type)} />
              <DetailRow icon={RiCalendarLine} label="Joined" value={fmtDate(employee.join_date)} />
              {employee.resigned_on && <DetailRow icon={RiCalendarLine} label="Resigned" value={fmtDate(employee.resigned_on)} />}
              <div className="grid grid-cols-2 gap-2 border-t pt-3">
                <SmallBox label="Assigned tasks" value={String(tasks.filter((t) => t.status !== "done").length)} />
                <SmallBox label="Expense claims" value={String(claims.length)} />
              </div>
            </CardContent>
          </Card>

          <ChartCard className="lg:col-span-8" title="Salary history" description="Recorded salary changes from the employee timeline.">
            <TrendChart
              data={salaryHistory}
              xKey="date"
              series={[{ key: "salary", label: "Monthly basic", color: "var(--chart-2)" }]}
              formatValue={(n) => money(n, cur)}
              height={250}
            />
          </ChartCard>

          <ChartCard className="lg:col-span-4" title="Attendance" description="Last 120 days.">
            <DonutChart data={attendanceMix} centerValue={`${attendanceSummary.credit}`} centerLabel="work days" height={200} />
          </ChartCard>

          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Leave balance</CardTitle>
              <CardDescription>{year} entitlement and usage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {balancesView.map((b) => (
                <div key={b.type} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium capitalize">{label(b.type)}</span>
                    <span className="text-muted-foreground">
                      {b.remaining} left of {b.entitled}
                    </span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div className="bg-chart-2 h-full rounded-full" style={{ width: `${b.entitled > 0 ? pct(b.used, b.entitled) : 0}%` }} />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full" nativeButton={false} render={<Link href="/forms" />}>
                Open leave requests
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Recent timeline</CardTitle>
              <CardDescription>Lifecycle events and notes.</CardDescription>
            </CardHeader>
            <CardContent>
              <Timeline events={events.slice(0, 5)} />
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "attendance" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SmallBox label="Present" value={String(attendanceSummary.present)} />
            <SmallBox label="Half day" value={String(attendanceSummary.half)} />
            <SmallBox label="Leave" value={String(attendanceSummary.leave)} />
            <SmallBox label="Absent" value={String(attendanceSummary.absent)} />
            <SmallBox label="OT hours" value={String(attendanceSummary.ot)} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">Work-day credit: {attendanceSummary.credit} day(s) across the last 120 days.</p>
            <Button variant="outline" nativeButton={false} render={<Link href={`/attendance/${employee.id}`} />}>
              Open full timesheet
            </Button>
          </div>
          <ChartCard title="Daily attendance" description="Work-day credit and overtime for recent attendance records.">
            <TrendChart
              data={attendanceTrend}
              xKey="date"
              series={[
                { key: "credit", label: "Work-day credit", color: "var(--chart-2)" },
                { key: "ot", label: "OT hours", color: "var(--chart-4)" },
              ]}
              formatAxis={(n) => String(n)}
              height={220}
            />
          </ChartCard>
          <Card>
            <CardHeader>
              <CardTitle>Attendance records</CardTitle>
              <CardDescription>{attendance.length} record(s) in the last 120 days.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check in</TableHead>
                    <TableHead>Check out</TableHead>
                    <TableHead className="text-right">OT hours</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.slice(0, 30).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{fmtDate(a.work_date)}</TableCell>
                      <TableCell><StatusBadge status={a.status} /></TableCell>
                      <TableCell>{a.check_in ? a.check_in.slice(11, 16) : "-"}</TableCell>
                      <TableCell>{a.check_out ? a.check_out.slice(11, 16) : "-"}</TableCell>
                      <TableCell className="text-right">{Number(a.ot_hours)}</TableCell>
                      <TableCell className="text-muted-foreground max-w-56 truncate text-xs">{a.notes ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                  {attendance.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-muted-foreground text-center">No attendance records.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "leave" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {balancesView.map((b) => (
              <Card key={b.type} size="sm">
                <CardContent>
                  <p className="text-muted-foreground text-xs capitalize">{label(b.type)} leave</p>
                  <p className="mt-1 text-2xl font-semibold">{b.remaining}</p>
                  <p className="text-muted-foreground text-xs">{b.used} used of {b.entitled} entitled</p>
                  <div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full">
                    <div className="bg-chart-2 h-full rounded-full" style={{ width: `${b.entitled > 0 ? pct(b.used, b.entitled) : 0}%` }} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle>Leave history</CardTitle>
                  <CardDescription>{leave.length} request(s) on record.</CardDescription>
                </div>
                <Button variant="outline" nativeButton={false} render={<Link href="/forms" />}>New request</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leave.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="capitalize">{label(l.leave_type)}</TableCell>
                      <TableCell>{fmtDate(l.start_date)} to {fmtDate(l.end_date)}</TableCell>
                      <TableCell className="text-right">{Number(l.days)}</TableCell>
                      <TableCell><StatusBadge status={l.status} /></TableCell>
                      <TableCell className="text-muted-foreground max-w-64 truncate text-xs">{l.reason ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                  {leave.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground text-center">No leave requests.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "payroll" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SmallBox label={`${year} gross`} value={money(ytd.gross, cur)} />
            <SmallBox label={`${year} deductions`} value={money(ytd.deductions, cur)} />
            <SmallBox label={`${year} net pay`} value={money(ytd.net, cur)} />
            <SmallBox label={`${year} employer SSB`} value={money(ytd.employerSsb, cur)} />
          </div>
          <ChartCard title="Net pay trend" description="Finalized payslips, most recent eight runs.">
            <TrendChart data={payslipTrend} xKey="month" series={[{ key: "net", label: "Net pay", color: "var(--chart-2)" }]} formatValue={(n) => money(n, cur)} height={220} />
          </ChartCard>
          <Card>
            <CardHeader>
              <CardTitle>Payslip history</CardTitle>
              <CardDescription>Open a payslip for the full earnings and deduction breakdown.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Work days</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">SSB</TableHead>
                    <TableHead className="text-right">PIT</TableHead>
                    <TableHead className="text-right">Net pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.map((p) => {
                    const run = runById.get(p.run_id)
                    const gross = Number(p.basic_amount) + Number(p.ot_amount) + Number(p.allowance) + Number(p.other_bonus)
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{run ? monthLabel(run.period_year, run.period_month) : "Unknown"}</TableCell>
                        <TableCell className="text-right">{Number(p.work_days)}</TableCell>
                        <TableCell className="text-right text-xs">{money(gross, cur)}</TableCell>
                        <TableCell className="text-right text-xs">{money(Number(p.ssb_employee), cur)}</TableCell>
                        <TableCell className="text-right text-xs">{money(Number(p.pit), cur)}</TableCell>
                        <TableCell className="text-right font-medium">{money(Number(p.net_pay), cur)}</TableCell>
                        <TableCell><StatusBadge status={run?.status ?? "unknown"} /></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="xs" nativeButton={false} render={<Link href={`/payslips/${p.id}`} />}>View</Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {payslips.length === 0 && <TableRow><TableCell colSpan={8} className="text-muted-foreground text-center">No payslips yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "documents" && (
        <div className="space-y-4">
          {expiringDocs.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              {expiringDocs.length} document(s) need attention: {expiringDocs.map((d) => `${d.name} (${documentState(d).label})`).join(", ")}
            </div>
          )}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle>Document register</CardTitle>
                  <CardDescription>Contracts, identity documents, licences and certificates. Files can be linked when storage is connected.</CardDescription>
                </div>
                <Button onClick={openDoc}>
                  <RiAddLine data-icon="inline-start" />
                  Add document
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((d) => {
                    const state = documentState(d)
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell className="capitalize">{label(d.doc_type)}</TableCell>
                        <TableCell>{fmtDate(d.issued_on)}</TableCell>
                        <TableCell>{fmtDate(d.expires_on)}</TableCell>
                        <TableCell><StatusBadge status={state.tone === "ok" ? "valid" : state.tone} /></TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">{d.reference ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          {d.file_url ? <Button variant="ghost" size="xs" render={<a href={d.file_url} target="_blank" rel="noreferrer" />}>Open</Button> : <span className="text-muted-foreground text-xs">Register only</span>}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {documents.length === 0 && <TableRow><TableCell colSpan={7} className="text-muted-foreground text-center">No documents registered.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "activity" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle>Employee timeline</CardTitle>
                  <CardDescription>Hires, salary changes, promotions and notes.</CardDescription>
                </div>
                <Button variant="outline" onClick={openNote}>Add note</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Timeline events={events} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>System activity</CardTitle>
              <CardDescription>Changes recorded against this employee.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activity.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm">{a.detail ?? a.action}</p>
                    <p className="text-muted-foreground text-xs">{a.actor} · {fmtDate(a.created_at.slice(0, 10))}</p>
                  </div>
                  <StatusBadge status={a.action} />
                </div>
              ))}
              {activity.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No system activity.</p>}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[88svh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>Contact and employment details for {employee.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></Field>
            <Field label="Phone"><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></Field>
            <Field label="NRC"><Input value={editForm.nrc_no} onChange={(e) => setEditForm({ ...editForm, nrc_no: e.target.value })} /></Field>
            <Field label="Department"><Input value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} /></Field>
            <Field label="Position"><Input value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} /></Field>
            <Field label="Employment type">
              <Select value={editForm.employment_type} onValueChange={(v) => setEditForm({ ...editForm, employment_type: String(v) })}>
                <SelectTrigger className="w-full"><SelectValue>{label(editForm.employment_type)}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full time</SelectItem>
                  <SelectItem value="part_time">Part time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: String(v) })}>
                <SelectTrigger className="w-full"><SelectValue>{editForm.status}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resigned">Resigned</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {editForm.status === "resigned" && (
              <Field label="Resigned on"><Input type="date" value={editForm.resigned_on} onChange={(e) => setEditForm({ ...editForm, resigned_on: e.target.value })} /></Field>
            )}
            <Field label="Address" className="sm:col-span-2"><Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></Field>
          </div>
          {dialogError && <p className="text-destructive text-sm">{dialogError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveProfile} disabled={busy}>{busy ? "Saving..." : "Save profile"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={salaryOpen} onOpenChange={setSalaryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change salary</DialogTitle>
            <DialogDescription>Updates the monthly basic and writes a salary event to the employee timeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="New monthly basic (MMK)"><Input type="number" min="0" value={salaryForm.amount} onChange={(e) => setSalaryForm({ ...salaryForm, amount: e.target.value })} /></Field>
            <Field label="Effective date"><Input type="date" value={salaryForm.effective_date} onChange={(e) => setSalaryForm({ ...salaryForm, effective_date: e.target.value })} /></Field>
            <Field label="Reason"><Textarea value={salaryForm.reason} onChange={(e) => setSalaryForm({ ...salaryForm, reason: e.target.value })} placeholder="Annual review, promotion, market adjustment" /></Field>
          </div>
          {dialogError && <p className="text-destructive text-sm">{dialogError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalaryOpen(false)}>Cancel</Button>
            <Button onClick={saveSalary} disabled={busy}>{busy ? "Saving..." : "Save salary"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={docOpen} onOpenChange={setDocOpen}>
        <DialogContent className="max-h-[88svh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add document</DialogTitle>
            <DialogDescription>Register metadata now. Link a file when storage is connected.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Document name" className="sm:col-span-2"><Input value={docForm.name} onChange={(e) => setDocForm({ ...docForm, name: e.target.value })} placeholder="Employment contract" /></Field>
            <Field label="Type">
              <Select value={docForm.doc_type} onValueChange={(v) => setDocForm({ ...docForm, doc_type: String(v) })}>
                <SelectTrigger className="w-full"><SelectValue>{label(docForm.doc_type)}</SelectValue></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{label(t)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reference"><Input value={docForm.reference} onChange={(e) => setDocForm({ ...docForm, reference: e.target.value })} /></Field>
            <Field label="Issued on"><Input type="date" value={docForm.issued_on} onChange={(e) => setDocForm({ ...docForm, issued_on: e.target.value })} /></Field>
            <Field label="Expires on"><Input type="date" value={docForm.expires_on} onChange={(e) => setDocForm({ ...docForm, expires_on: e.target.value })} /></Field>
            <Field label="File link" className="sm:col-span-2"><Input value={docForm.file_url} onChange={(e) => setDocForm({ ...docForm, file_url: e.target.value })} placeholder="https://..." /></Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea value={docForm.notes} onChange={(e) => setDocForm({ ...docForm, notes: e.target.value })} /></Field>
          </div>
          {dialogError && <p className="text-destructive text-sm">{dialogError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocOpen(false)}>Cancel</Button>
            <Button onClick={saveDocument} disabled={busy}>{busy ? "Saving..." : "Add document"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add note</DialogTitle>
            <DialogDescription>Append a dated note to the employee timeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Title"><Input value={noteForm.title} onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })} /></Field>
            <Field label="Date"><Input type="date" value={noteForm.effective_date} onChange={(e) => setNoteForm({ ...noteForm, effective_date: e.target.value })} /></Field>
            <Field label="Detail"><Textarea value={noteForm.detail} onChange={(e) => setNoteForm({ ...noteForm, detail: e.target.value })} /></Field>
          </div>
          {dialogError && <p className="text-destructive text-sm">{dialogError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button onClick={saveNote} disabled={busy}>{busy ? "Saving..." : "Add note"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className ? `space-y-1.5 ${className}` : "space-y-1.5"}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof RiMailLine; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] uppercase tracking-wide">{label}</p>
        <p className="truncate text-sm">{value}</p>
      </div>
    </div>
  )
}

function SmallBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-[11px] uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
    </div>
  )
}

function StatTile({ icon: Icon, label, value, hint }: { icon: typeof RiMailLine; label: string; value: string; hint: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="truncate text-lg font-semibold tracking-tight">{value}</p>
          <p className="text-muted-foreground truncate text-[11px]">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function Timeline({ events }: { events: EmployeeEventRow[] }) {
  if (events.length === 0) return <p className="text-muted-foreground py-6 text-center text-sm">No timeline events.</p>
  return (
    <div className="relative space-y-4 before:absolute before:left-3 before:top-1 before:h-[calc(100%-8px)] before:w-px before:bg-border">
      {events.map((e) => (
        <div key={e.id} className="relative flex gap-3">
          <span className="bg-background ring-border relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ring-1">
            <RiTimeLine className="text-muted-foreground size-3" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{e.title}</p>
              <StatusBadge status={e.event_type} />
            </div>
            {e.detail && <p className="text-muted-foreground text-xs">{e.detail}</p>}
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              {fmtDate(e.effective_date)}
              {e.amount ? ` · ${money(Number(e.amount))}` : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
