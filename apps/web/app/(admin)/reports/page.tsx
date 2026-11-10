"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
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
import { ChartCard, DonutChart, HorizontalBars, TrendChart } from "@/components/charts"
import { supabase } from "@/lib/supabase"
import type { AppSettingsRow, EmployeeRow, PayrollRunRow, PayslipRow } from "@/lib/payroll"
import { money, monthEnd, monthNames, monthStart, todayStr } from "@/lib/format"
import { monthLabel, pct } from "@/lib/hr"

type AttendanceLite = { employee_id: string; status: string; ot_hours: number }
type RunWithSlips = PayrollRunRow & { payslips?: PayslipRow[] }

const YEARS = [Number(todayStr().slice(0, 4)) - 1, Number(todayStr().slice(0, 4)), Number(todayStr().slice(0, 4)) + 1]
const ATT_STATUSES = ["present", "half_day", "leave", "holiday", "absent"]
const ATT_COLORS: Record<string, string> = {
  present: "#10b981",
  half_day: "#f59e0b",
  leave: "#0ea5e9",
  holiday: "#8b5cf6",
  absent: "#ef4444",
}

const sum = (rows: number[]) => rows.reduce((s, n) => s + Number(n || 0), 0)

export default function ReportsPage() {
  const [month, setMonth] = useState(Number(todayStr().slice(5, 7)))
  const [year, setYear] = useState(Number(todayStr().slice(0, 4)))
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [attendance, setAttendance] = useState<AttendanceLite[]>([])
  const [run, setRun] = useState<PayrollRunRow | null>(null)
  const [slips, setSlips] = useState<PayslipRow[]>([])
  const [trendRuns, setTrendRuns] = useState<RunWithSlips[]>([])
  const [settings, setSettings] = useState<AppSettingsRow | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (m: number, y: number) => {
    setLoading(true)
    const [{ data: emps }, { data: att }, { data: r }, { data: s }, { data: history }] = await Promise.all([
      supabase.from("employees").select("*").order("employee_code"),
      supabase
        .from("attendance")
        .select("employee_id, status, ot_hours")
        .gte("work_date", monthStart(y, m))
        .lte("work_date", monthEnd(y, m)),
      supabase
        .from("payroll_runs")
        .select("*")
        .eq("period_month", m)
        .eq("period_year", y)
        .maybeSingle(),
      supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("payroll_runs")
        .select("*, payslips(net_pay, basic_amount, ot_amount, allowance, other_bonus, ssb_employer)")
        .eq("status", "finalized")
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false })
        .limit(8),
    ])
    setEmployees((emps as EmployeeRow[]) ?? [])
    setAttendance((att as AttendanceLite[]) ?? [])
    setSettings((s as AppSettingsRow) ?? null)
    setTrendRuns((history as RunWithSlips[]) ?? [])
    const found = (r as PayrollRunRow) ?? null
    setRun(found)
    if (found) {
      const { data: slipRows } = await supabase.from("payslips").select("*").eq("run_id", found.id)
      setSlips((slipRows as PayslipRow[]) ?? [])
    } else {
      setSlips([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load(month, year).catch(() => setLoading(false))
  }, [load, month, year])

  const active = useMemo(() => employees.filter((e) => e.status === "active"), [employees])

  const departments = useMemo(() => {
    const map = new Map<string, { count: number; salary: number }>()
    for (const e of active) {
      const cur = map.get(e.department) ?? { count: 0, salary: 0 }
      cur.count++
      cur.salary += Number(e.base_salary)
      map.set(e.department, cur)
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count)
  }, [active])

  const departmentBars = departments.map(([label, row]) => ({ label, value: row.count, hint: `${row.count} staff · ${money(row.salary, "MMK")}` }))

  const attCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of attendance) map[a.status] = (map[a.status] ?? 0) + 1
    return map
  }, [attendance])

  const attMix = ATT_STATUSES.map((s) => ({ name: s, value: attCounts[s] ?? 0, color: ATT_COLORS[s] })).filter((d) => d.value > 0)

  const totals = useMemo(
    () =>
      slips.reduce(
        (s, p) => {
          s.basic += Number(p.basic_amount)
          s.ot += Number(p.ot_amount)
          s.allowance += Number(p.allowance)
          s.bonus += Number(p.other_bonus)
          s.ssbEmployee += Number(p.ssb_employee)
          s.ssbEmployer += Number(p.ssb_employer)
          s.pit += Number(p.pit)
          s.net += Number(p.net_pay)
          return s
        },
        { basic: 0, ot: 0, allowance: 0, bonus: 0, ssbEmployee: 0, ssbEmployer: 0, pit: 0, net: 0 }
      ),
    [slips]
  )

  const payrollTrend = useMemo(
    () =>
      [...trendRuns].reverse().map((r) => {
        const rows = r.payslips ?? []
        return {
          period: monthLabel(r.period_year, r.period_month).slice(0, 3),
          net: sum(rows.map((p) => p.net_pay)),
          employer: sum(rows.map((p) => Number(p.basic_amount) + Number(p.ot_amount) + Number(p.allowance) + Number(p.other_bonus) + Number(p.ssb_employer))),
        }
      }),
    [trendRuns]
  )

  const composition = [
    { name: "Basic", value: totals.basic, color: "#0ea5e9" },
    { name: "Overtime", value: totals.ot, color: "#f59e0b" },
    { name: "Allowance", value: totals.allowance, color: "#8b5cf6" },
    { name: "Bonus", value: totals.bonus, color: "#10b981" },
  ].filter((d) => d.value > 0)

  const cur = settings?.currency ?? "MMK"
  const absenceRate = pct(attCounts["absent"] ?? 0, Math.max(1, attendance.length))
  const employerCost = totals.basic + totals.ot + totals.allowance + totals.bonus + totals.ssbEmployer

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Headcount, attendance and payroll analytics for the selected month, plus payroll history."
        actions={
          <div className="flex gap-2">
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue>{monthNames[month - 1]}</SelectValue></SelectTrigger>
              <SelectContent>
                {monthNames.map((n, i) => <SelectItem key={n} value={String(i + 1)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-24"><SelectValue>{year}</SelectValue></SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active staff" value={loading ? "..." : String(active.length)} hint={`${departments.length} department(s)`} />
        <Stat label="Attendance days logged" value={loading ? "..." : String(attendance.length)} hint={`${absenceRate}% absence rate`} />
        <Stat label="Payroll net" value={loading ? "..." : run ? money(totals.net, cur) : "No run"} hint={run ? `${slips.length} payslip(s) · ${run.status}` : "No run for this month"} />
        <Stat label="Employer cost" value={loading || !run ? "..." : money(employerCost, cur)} hint="gross plus employer SSB" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <ChartCard className="lg:col-span-7" title="Payroll cost history" description="Net pay and employer cost for the latest finalized runs.">
          <TrendChart
            data={payrollTrend}
            xKey="period"
            series={[
              { key: "net", label: "Net pay", color: "var(--chart-2)" },
              { key: "employer", label: "Employer cost", color: "var(--chart-4)" },
            ]}
            formatValue={(n) => money(n, cur)}
            height={250}
          />
        </ChartCard>
        <ChartCard className="lg:col-span-5" title="Attendance mix" description={`${monthNames[month - 1]} ${year}, ${attendance.length} day(s) logged.`}>
          <DonutChart data={attMix} centerValue={String(attendance.length)} centerLabel="days logged" formatValue={(n) => `${n} day(s)`} height={230} />
        </ChartCard>

        <ChartCard className="lg:col-span-4" title="Headcount by department" description="Active employees per department.">
          <HorizontalBars data={departmentBars} formatValue={(n) => `${n} staff`} />
        </ChartCard>

        <ChartCard className="lg:col-span-4" title="Payroll composition" description={run ? `${monthNames[month - 1]} ${year}` : "No run for this month"}>
          {composition.length > 0 ? (
            <DonutChart data={composition} centerValue={money(totals.net, cur)} centerLabel="net" formatValue={(n) => money(n, cur)} height={210} />
          ) : (
            <p className="text-muted-foreground py-10 text-center text-sm">No payroll data.</p>
          )}
        </ChartCard>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Payroll summary
              {run && <Badge variant={run.status === "finalized" ? "secondary" : "default"}>{run.status}</Badge>}
            </CardTitle>
            <CardDescription>
              {run ? `${monthNames[month - 1]} ${year}, ${slips.length} payslip(s)` : "No payroll run for this month."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {run ? (
              <div className="grid grid-cols-2 gap-2">
                <Line label="Basic" value={money(totals.basic, cur)} />
                <Line label="Overtime" value={money(totals.ot, cur)} />
                <Line label="SSB employee" value={money(totals.ssbEmployee, cur)} />
                <Line label="SSB employer" value={money(totals.ssbEmployer, cur)} />
                <Line label="PIT" value={money(totals.pit, cur)} />
                <Line label="Net pay" value={money(totals.net, cur)} />
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Compute or finalize a run in Payroll to see totals here.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Department salary base</CardTitle>
            <CardDescription>Active employees and monthly basic salary.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Staff</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map(([dept, row]) => (
                  <TableRow key={dept}>
                    <TableCell>{dept}</TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                    <TableCell className="text-right">{money(row.salary, cur)}</TableCell>
                  </TableRow>
                ))}
                {departments.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-muted-foreground text-center">No active employees.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance detail</CardTitle>
            <CardDescription>{monthNames[month - 1]} {year} by status.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ATT_STATUSES.map((s) => (
                  <TableRow key={s}>
                    <TableCell className="capitalize">{s.replace("_", " ")}</TableCell>
                    <TableCell className="text-right">{attCounts[s] ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-1 truncate text-xl font-semibold tracking-tight">{value}</p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">{hint}</p>
      </CardContent>
    </Card>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  )
}
