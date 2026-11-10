"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  RiArrowRightSLine,
  RiBankCardLine,
  RiCalendarCheckLine,
  RiFileList2Line,
  RiFileWarningLine,
  RiTeamLine,
  RiTimeLine,
  RiWalletLine,
} from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { ChartCard, DonutChart, HorizontalBars, TrendChart } from "@/components/charts"
import { supabase } from "@/lib/supabase"
import type { AppSettingsRow, EmployeeRow, PayrollRunRow, PayslipRow } from "@/lib/payroll"
import { fmtDate, money, monthEnd, monthNames, monthStart, todayStr } from "@/lib/format"
import {
  daysUntil,
  documentState,
  monthLabel,
  pct,
  recentMonths,
  type ActivityRow,
  type ApplicantRow,
  type EmployeeDocumentRow,
  type ExpenseClaimRow,
  type JobPostRow,
  type LeaveRequestRow,
  type TaskRow,
} from "@/lib/hr"

type RunWithSlips = PayrollRunRow & { payslips?: Pick<PayslipRow, "net_pay" | "basic_amount" | "ot_amount" | "allowance" | "other_bonus" | "ssb_employee" | "ssb_employer" | "pit">[] }

const sum = (rows: number[]) => rows.reduce((s, n) => s + Number(n || 0), 0)

export default function OverviewPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [attendance, setAttendance] = useState<{ employee_id: string; work_date: string; status: string; ot_hours: number }[]>([])
  const [runs, setRuns] = useState<RunWithSlips[]>([])
  const [leave, setLeave] = useState<LeaveRequestRow[]>([])
  const [claims, setClaims] = useState<ExpenseClaimRow[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [jobs, setJobs] = useState<JobPostRow[]>([])
  const [applicants, setApplicants] = useState<ApplicantRow[]>([])
  const [documents, setDocuments] = useState<EmployeeDocumentRow[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [settings, setSettings] = useState<AppSettingsRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const today = todayStr()
      const y = Number(today.slice(0, 4))
      const m = Number(today.slice(5, 7))
      const [emps, att, runRows, leaveRows, claimRows, taskRows, jobRows, applicantRows, docRows, actRows, s] =
        await Promise.all([
          supabase.from("employees").select("*").order("employee_code"),
          supabase
            .from("attendance")
            .select("employee_id, work_date, status, ot_hours")
            .gte("work_date", monthStart(y, m))
            .lte("work_date", monthEnd(y, m)),
          supabase
            .from("payroll_runs")
            .select("*, payslips(net_pay, basic_amount, ot_amount, allowance, other_bonus, ssb_employee, ssb_employer, pit)")
            .eq("status", "finalized")
            .order("period_year", { ascending: false })
            .order("period_month", { ascending: false })
            .limit(12),
          supabase.from("leave_requests").select("*"),
          supabase.from("expense_claims").select("*"),
          supabase.from("tasks").select("*"),
          supabase.from("job_posts").select("*"),
          supabase.from("applicants").select("*"),
          supabase.from("employee_documents").select("*"),
          supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(10),
          supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
        ])
      if (cancelled) return
      setEmployees((emps.data as EmployeeRow[]) ?? [])
      setAttendance((att.data as typeof attendance) ?? [])
      setRuns((runRows.data as RunWithSlips[]) ?? [])
      setLeave((leaveRows.data as LeaveRequestRow[]) ?? [])
      setClaims((claimRows.data as ExpenseClaimRow[]) ?? [])
      setTasks((taskRows.data as TaskRow[]) ?? [])
      setJobs((jobRows.data as JobPostRow[]) ?? [])
      setApplicants((applicantRows.data as ApplicantRow[]) ?? [])
      setDocuments((docRows.data as EmployeeDocumentRow[]) ?? [])
      setActivity((actRows.data as ActivityRow[]) ?? [])
      setSettings((s.data as AppSettingsRow) ?? null)
      setLoading(false)
    })().catch(() => setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const today = todayStr()
  const cur = settings?.currency ?? "MMK"
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const active = useMemo(() => employees.filter((e) => e.status === "active"), [employees])
  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])

  const todayAtt = attendance.filter((a) => a.work_date === today)
  const presentToday = todayAtt.filter((a) => a.status === "present" || a.status === "half_day").length
  const newHires = active.filter((e) => e.join_date.slice(0, 7) === today.slice(0, 7)).length
  const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10)
  const resignedYear = employees.filter((e) => e.resigned_on && e.resigned_on >= yearAgo).length
  const attrition = pct(resignedYear, Math.max(1, active.length))
  const absentDays = attendance.filter((a) => a.status === "absent").length
  const absenceRate = pct(absentDays, Math.max(1, attendance.length))

  const latestRun = runs[0]
  const latestNet = latestRun ? sum((latestRun.payslips ?? []).map((p) => p.net_pay)) : 0
  const latestEmployer = latestRun
    ? sum((latestRun.payslips ?? []).map((p) => Number(p.basic_amount) + Number(p.ot_amount) + Number(p.allowance) + Number(p.other_bonus) + Number(p.ssb_employer)))
    : 0
  const pendingLeave = leave.filter((l) => l.status === "pending").length
  const pendingClaims = claims.filter((c) => c.status === "pending").length
  const overdueTasks = tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < today).length
  const expiringDocs = documents.filter((d) => {
    const days = daysUntil(d.expires_on)
    return days !== null && days <= 60
  }).length

  const headcountTrend = useMemo(() => {
    return recentMonths(12, now).map(({ year, month, label }) => {
      const end = monthEnd(year, month)
      const start = monthStart(year, month)
      const count = employees.filter((e) => e.join_date <= end && (!e.resigned_on || e.resigned_on >= start)).length
      const hires = employees.filter((e) => e.join_date >= start && e.join_date <= end).length
      return { month: label.replace(` ${year}`, "").slice(0, 3), headcount: count, hires }
    })
  }, [employees, now])

  const payrollTrend = useMemo(() => {
    return [...runs].reverse().map((r) => {
      const slips = r.payslips ?? []
      const net = sum(slips.map((p) => p.net_pay))
      const gross = sum(slips.map((p) => Number(p.basic_amount) + Number(p.ot_amount) + Number(p.allowance) + Number(p.other_bonus)))
      const employer = gross + sum(slips.map((p) => p.ssb_employer))
      return { month: `${monthNames[r.period_month - 1]?.slice(0, 3)} ${String(r.period_year).slice(2)}`, net, employer }
    })
  }, [runs])

  const attendanceMix = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of attendance) counts.set(a.status, (counts.get(a.status) ?? 0) + 1)
    const colors: Record<string, string> = {
      present: "#10b981",
      half_day: "#f59e0b",
      leave: "#0ea5e9",
      holiday: "#8b5cf6",
      absent: "#ef4444",
    }
    return ["present", "half_day", "leave", "holiday", "absent"]
      .map((key) => ({ name: key, value: counts.get(key) ?? 0, color: colors[key] }))
      .filter((d) => d.value > 0)
  }, [attendance])

  const departments = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of active) map.set(e.department, (map.get(e.department) ?? 0) + 1)
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, hint: `${value} staff` }))
  }, [active])

  const funnel = useMemo(() => {
    const order = ["applied", "screening", "interview", "offer", "hired"]
    const rank = new Map(order.map((stage, i) => [stage, i]))
    const applied = applicants.length || 1
    return order.map((stage, i) => {
      const value = applicants.filter((a) => (rank.get(a.stage) ?? -1) >= i).length
      return { label: stage, value, hint: `${value} · ${pct(value, applied)}%` }
    })
  }, [applicants])

  const expenseMix = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of claims) {
      if (c.status === "rejected") continue
      map.set(c.category, (map.get(c.category) ?? 0) + Number(c.amount))
    }
    const colors: Record<string, string> = {
      travel: "#0ea5e9",
      meals: "#f59e0b",
      supplies: "#8b5cf6",
      fuel: "#10b981",
      other: "#64748b",
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value, color: colors[name] }))
      .sort((a, b) => b.value - a.value)
  }, [claims])

  const approvals = useMemo(() => {
    const leaveRows = leave
      .filter((l) => l.status === "pending")
      .map((l) => ({
        id: l.id,
        title: `${byId.get(l.employee_id)?.name ?? "Employee"} requested ${l.leave_type} leave`,
        sub: `${fmtDate(l.start_date)} to ${fmtDate(l.end_date)} · ${l.days} day(s)`,
        href: "/forms",
        kind: "Leave",
        icon: RiFileList2Line,
      }))
    const claimRows = claims
      .filter((c) => c.status === "pending")
      .map((c) => ({
        id: c.id,
        title: c.description ?? "Expense claim",
        sub: `${byId.get(c.employee_id)?.name ?? "Employee"} · ${money(Number(c.amount), cur)}`,
        href: "/expense-claims",
        kind: "Expense",
        icon: RiWalletLine,
      }))
    return [...leaveRows, ...claimRows].slice(0, 6)
  }, [leave, claims, byId, cur])

  const expiring = useMemo(
    () =>
      documents
        .filter((d) => {
          const days = daysUntil(d.expires_on)
          return days !== null && days <= 60
        })
        .sort((a, b) => (daysUntil(a.expires_on) ?? 0) - (daysUntil(b.expires_on) ?? 0))
        .slice(0, 5),
    [documents]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={`${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${active.length} active staff across ${departments.length} departments`}
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/reports" />}>
              Open reports
            </Button>
            <Button nativeButton={false} render={<Link href="/payroll" />}>
              <RiBankCardLine data-icon="inline-start" />
              Run payroll
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={RiTeamLine}
          label="Active headcount"
          value={loading ? "..." : String(active.length)}
          hint={`${newHires} new hire(s) this month`}
          href="/employees"
        />
        <KpiCard
          icon={RiCalendarCheckLine}
          label="On duty today"
          value={loading ? "..." : `${presentToday}/${active.length}`}
          hint={`${pct(presentToday, Math.max(1, active.length))}% attendance · absence ${absenceRate}% MTD`}
          href="/attendance"
        />
        <KpiCard
          icon={RiBankCardLine}
          label={latestRun ? `Net pay · ${monthLabel(latestRun.period_year, latestRun.period_month)}` : "Latest net pay"}
          value={loading ? "..." : latestRun ? money(latestNet, cur) : "No finalized run"}
          hint={latestRun ? `Employer cost ${money(latestEmployer, cur)}` : "Finalize a run to see payroll cost"}
          href={latestRun ? `/payroll/${latestRun.id}` : "/payroll"}
        />
        <KpiCard
          icon={RiFileList2Line}
          label="Pending approvals"
          value={loading ? "..." : String(pendingLeave + pendingClaims)}
          hint={`${pendingLeave} leave · ${pendingClaims} expense claims`}
          href="/forms"
          badge={overdueTasks > 0 ? `${overdueTasks} overdue task(s)` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <ChartCard
          className="lg:col-span-7"
          title="Headcount trend"
          description="Active employees at each month end, with new hires."
        >
          <TrendChart
            data={headcountTrend}
            xKey="month"
            series={[
              { key: "headcount", label: "Headcount", color: "var(--chart-2)" },
              { key: "hires", label: "New hires", color: "var(--chart-4)" },
            ]}
            formatValue={(n) => `${n} employee(s)`}
            formatAxis={(n) => String(n)}
            height={260}
          />
        </ChartCard>
        <ChartCard
          className="lg:col-span-5"
          title="Payroll cost"
          description="Net pay and total employer cost across finalized runs."
        >
          <TrendChart
            data={payrollTrend}
            xKey="month"
            series={[
              { key: "net", label: "Net pay", color: "var(--chart-2)" },
              { key: "employer", label: "Employer cost", color: "var(--chart-4)" },
            ]}
            formatValue={(n) => money(n, cur)}
            height={260}
          />
        </ChartCard>

        <ChartCard
          className="lg:col-span-5"
          title="Attendance mix"
          description={`${monthNames[m - 1]} ${y} to date`}
        >
          <DonutChart
            data={attendanceMix}
            centerValue={String(attendance.length)}
            centerLabel="days logged"
            formatValue={(n) => `${n} day(s)`}
            height={210}
          />
        </ChartCard>
        <ChartCard
          className="lg:col-span-4"
          title="Headcount by department"
          description="Active employees per department."
        >
          <HorizontalBars data={departments} />
        </ChartCard>
        <ChartCard
          className="lg:col-span-3"
          title="Recruitment funnel"
          description="Applicants by current stage."
        >
          <HorizontalBars data={funnel} />
        </ChartCard>

        <ChartCard
          className="lg:col-span-4"
          title="Expense mix"
          description="Claims excluding rejected, by category."
        >
          <DonutChart data={expenseMix} centerValue={money(sum(expenseMix.map((e) => e.value)), cur)} centerLabel="claimed" formatValue={(n) => money(n, cur)} height={210} />
        </ChartCard>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RiTimeLine className="size-4" />
              Needs attention
            </CardTitle>
            <CardDescription>Approvals, overdue work and expiring documents.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniStat label="Approvals" value={pendingLeave + pendingClaims} href="/forms" />
              <MiniStat label="Overdue" value={overdueTasks} href="/team-tasks" />
              <MiniStat label="Expiring" value={expiringDocs} href="/employees" />
            </div>
            <div className="space-y-2">
              {approvals.slice(0, 3).map((a) => (
                <Link key={a.id} href={a.href} className="hover:bg-muted flex items-center gap-2 rounded-lg border p-2 transition-colors">
                  <a.icon className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{a.title}</span>
                    <span className="text-muted-foreground block truncate text-[11px]">{a.sub}</span>
                  </span>
                  <StatusBadge status={a.kind.toLowerCase()} />
                </Link>
              ))}
              {approvals.length === 0 && <p className="text-muted-foreground py-3 text-center text-xs">No pending approvals.</p>}
            </div>
            {expiring.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide">
                  <RiFileWarningLine className="size-3.5" /> Document expiry
                </p>
                {expiring.slice(0, 2).map((d) => (
                  <Link key={d.id} href={`/employees/${d.employee_id}`} className="hover:bg-muted flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs transition-colors">
                    <span className="min-w-0 truncate">
                      {d.name} · {byId.get(d.employee_id)?.name ?? "Employee"}
                    </span>
                    <StatusBadge status={documentState(d).tone} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest changes across people, payroll and approvals.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activity.slice(0, 6).map((a) => (
                <div key={a.id} className="flex gap-3">
                  <span className="bg-muted mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                    <RiFileList2Line className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{a.detail ?? a.action}</p>
                    <p className="text-muted-foreground text-[11px]">
                      {a.actor} · {fmtDate(a.created_at.slice(0, 10))}
                    </p>
                  </div>
                  <StatusBadge status={a.action} />
                </div>
              ))}
              {activity.length === 0 && <p className="text-muted-foreground py-6 text-center text-xs">No activity yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SmallStat label="Attrition, rolling 12 months" value={`${attrition}%`} hint={`${resignedYear} resignation(s)`} />
        <SmallStat label="Absence rate, month to date" value={`${absenceRate}%`} hint={`${absentDays} absent day(s)`} />
        <SmallStat label="Open roles" value={String(jobs.filter((j) => j.status === "open").length)} hint={`${applicants.length} applicants in pipeline`} />
        <SmallStat
          label="Payroll runs on record"
          value={String(runs.length)}
          hint={latestRun ? `Latest ${monthLabel(latestRun.period_year, latestRun.period_month)}` : "No finalized runs"}
        />
      </div>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  badge,
}: {
  icon: typeof RiTeamLine
  label: string
  value: string
  hint: string
  href: string
  badge?: string
}) {
  return (
    <Link href={href} className="group">
      <Card className="hover:ring-foreground/20 h-full transition-all group-hover:-translate-y-0.5">
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
            </div>
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Icon className="size-4" />
            </span>
          </div>
          <p className="text-muted-foreground text-xs">{hint}</p>
          {badge && <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{badge}</p>}
        </CardContent>
      </Card>
    </Link>
  )
}

function MiniStat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="hover:bg-muted rounded-lg border p-2 transition-colors">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-muted-foreground text-[11px]">{label}</p>
    </Link>
  )
}

function SmallStat({ label, value, hint }: { label: string; value: string; hint: string }) {
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
