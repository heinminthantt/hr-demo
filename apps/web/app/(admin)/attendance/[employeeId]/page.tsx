"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { RiArrowLeftLine, RiCalendarCheckLine, RiDownloadLine, RiSaveLine } from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
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
import { StatusBadge } from "@/components/status-badge"
import { ChartCard, DonutChart, BarSeriesChart } from "@/components/charts"
import { supabase } from "@/lib/supabase"
import type { AttendanceRow, EmployeeRow } from "@/lib/payroll"
import { WORKDAY_WEIGHTS, otHoursFrom, workDaysFrom } from "@/lib/payroll"
import { fmtDate, isoAt, monthEnd, monthNames, monthStart, timeOf, todayStr } from "@/lib/format"
import { initials, tenureLabel } from "@/lib/hr"
import { downloadCsv } from "@/lib/csv"

type Status = "present" | "half_day" | "absent" | "leave" | "holiday"
type DayRow = {
  date: string
  weekday: number
  status: Status
  check_in: string
  check_out: string
  ot_hours: string
  notes: string
  exists: boolean
}

const STATUSES: Status[] = ["present", "half_day", "absent", "leave", "holiday"]
const label = (s: string) => s.replaceAll("_", " ")
const round1 = (n: number) => Math.round(n * 10) / 10

function daysInMonth(year: number, month: number): string[] {
  const out: string[] = []
  const last = Number(monthEnd(year, month).slice(8, 10))
  for (let day = 1; day <= last; day++) out.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
  return out
}

export default function TimesheetPage() {
  const params = useParams<{ employeeId: string }>()
  const id = String(params.employeeId)
  const today = todayStr()
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
  const [employee, setEmployee] = useState<EmployeeRow | null>(null)
  const [records, setRecords] = useState<Map<string, AttendanceRow>>(new Map())
  const [days, setDays] = useState<DayRow[]>([])
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notFound, setNotFound] = useState(false)

  const [year = now.getFullYear(), monthNumber = now.getMonth() + 1] = month.split("-").map(Number)

  const buildRows = useCallback((recordsMap: Map<string, AttendanceRow>, y: number, m: number): DayRow[] => {
    return daysInMonth(y, m).map((date) => {
      const rec = recordsMap.get(date)
      const weekday = new Date(`${date}T00:00:00`).getDay()
      return {
        date,
        weekday,
        status: (rec?.status as Status) ?? "absent",
        check_in: timeOf(rec?.check_in ?? null),
        check_out: timeOf(rec?.check_out ?? null),
        ot_hours: String(rec?.ot_hours ?? 0),
        notes: rec?.notes ?? "",
        exists: Boolean(rec),
      }
    })
  }, [])

  const load = useCallback(
    async (y: number, m: number) => {
      setLoading(true)
      setError("")
      const [empRes, attRes] = await Promise.all([
        supabase.from("employees").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("attendance")
          .select("*")
          .eq("employee_id", id)
          .gte("work_date", monthStart(y, m))
          .lte("work_date", monthEnd(y, m))
          .order("work_date"),
      ])
      if (empRes.error) setError(empRes.error.message)
      if (!empRes.data) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setEmployee(empRes.data as EmployeeRow)
      const map = new Map<string, AttendanceRow>()
      for (const row of (attRes.data as AttendanceRow[]) ?? []) map.set(row.work_date, row)
      setRecords(map)
      setDays(buildRows(map, y, m))
      setDirty(new Set())
      setLoading(false)
    },
    [id, buildRows]
  )

  useEffect(() => {
    load(year, monthNumber).catch(() => setLoading(false))
  }, [load, year, monthNumber])

  const setDay = (date: string, patch: Partial<DayRow>) => {
    setDays((prev) => prev.map((d) => (d.date === date ? { ...d, ...patch } : d)))
    setDirty((prev) => new Set(prev).add(date))
  }

  const setStatus = (day: DayRow, status: Status) => {
    if (status === "present") setDay(day.date, { status, check_in: day.check_in || "09:00", check_out: day.check_out || "17:30", ot_hours: day.ot_hours })
    else if (status === "half_day") setDay(day.date, { status, check_in: day.check_in || "09:00", check_out: "13:00" })
    else setDay(day.date, { status, check_in: "", check_out: "", ot_hours: "0" })
  }

  const monthDates = useMemo(() => days.filter((d) => d.date <= today && d.date >= (employee?.join_date ?? "0000-00-00")), [days, today, employee])

  const summary = useMemo(() => {
    const saved = monthDates.filter((d) => d.exists)
    const credit = saved.reduce((s, d) => s + (WORKDAY_WEIGHTS[d.status] ?? 0), 0)
    const ot = saved.reduce((s, d) => s + (d.status === "absent" ? 0 : Number(d.ot_hours) || 0), 0)
    const hours = saved.reduce((s, d) => {
      if (!d.check_in || !d.check_out) return s
      const [ih = 0, im = 0] = d.check_in.split(":").map(Number)
      const [oh = 0, om = 0] = d.check_out.split(":").map(Number)
      return s + Math.max(0, (oh * 60 + om - ih * 60 - im) / 60)
    }, 0)
    const counts = STATUSES.map((status) => ({
      name: status,
      value: saved.filter((d) => d.status === status).length,
      color:
        status === "present" ? "#10b981" : status === "half_day" ? "#f59e0b" : status === "leave" ? "#0ea5e9" : status === "holiday" ? "#8b5cf6" : "#ef4444",
    })).filter((d) => d.value > 0)
    return {
      present: saved.filter((d) => d.status === "present").length,
      leave: saved.filter((d) => d.status === "leave").length,
      absent: saved.filter((d) => d.status === "absent").length,
      credit: round1(credit),
      ot: round1(ot),
      hours: round1(hours),
      counts,
      logged: saved.length,
      workdays: days.filter((d) => d.weekday !== 0 && d.date <= today && d.date >= (employee?.join_date ?? "0000-00-00")).length,
    }
  }, [monthDates, days, today, employee])

  const chartData = useMemo(
    () =>
      monthDates
        .filter((d) => d.exists && d.weekday !== 0)
        .map((d) => {
          let hours = 0
          if (d.check_in && d.check_out) {
            const [ih = 0, im = 0] = d.check_in.split(":").map(Number)
            const [oh = 0, om = 0] = d.check_out.split(":").map(Number)
            hours = Math.max(0, (oh * 60 + om - ih * 60 - im) / 60)
          }
          return { day: d.date.slice(8, 10), hours: round1(hours), ot: round1(Number(d.ot_hours) || 0) }
        }),
    [monthDates]
  )

  const save = async () => {
    if (dirty.size === 0) return
    setSaving(true)
    setError("")
    const payload = days
      .filter((d) => dirty.has(d.date))
      .map((d) => ({
        employee_id: id,
        work_date: d.date,
        status: d.status,
        check_in: d.check_in ? isoAt(d.date, d.check_in) : null,
        check_out: d.check_out ? isoAt(d.date, d.check_out) : null,
        ot_hours: Number(d.ot_hours) || 0,
        notes: d.notes.trim() || null,
      }))
    const res = await supabase.from("attendance").upsert(payload, { onConflict: "employee_id,work_date" })
    setSaving(false)
    if (res.error) {
      setError(res.error.message)
      return
    }
    await supabase.from("activity_log").insert({
      entity: "employee",
      entity_id: id,
      action: "attendance_updated",
      detail: `${payload.length} attendance day(s) updated for ${monthNames[monthNumber - 1]} ${year}`,
    })
    await load(year, monthNumber)
  }

  const exportCsv = () => {
    if (!employee) return
    downloadCsv(
      `${employee.employee_code}-attendance-${month}.csv`,
      ["Date", "Day", "Status", "Check in", "Check out", "OT hours", "Notes"],
      monthDates.map((d) => [
        d.date,
        d.weekday === 0 ? "Sunday" : "Workday",
        d.status,
        d.check_in,
        d.check_out,
        Number(d.ot_hours) || 0,
        d.notes,
      ])
    )
  }

  if (loading) return <p className="text-muted-foreground p-6 text-sm">Loading timesheet...</p>
  if (notFound || !employee) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm">This employee could not be found.</p>
        <Button variant="outline" nativeButton={false} render={<Link href="/attendance" />}>Back to attendance</Button>
      </div>
    )
  }

  const isDraft = dirty.size > 0

  return (
    <div className="space-y-5">
      <PageHeader
        backHref="/attendance"
        backLabel="Attendance"
        leading={
          <span className="from-primary/25 to-primary/5 text-primary ring-primary/15 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-semibold ring-1">
            {initials(employee.name)}
          </span>
        }
        title={employee.name}
        meta={<StatusBadge status={employee.status} />}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs">{employee.employee_code}</span>
            <span>·</span>
            <span>{employee.department}</span>
            <span>·</span>
            <span>{tenureLabel(employee.join_date, employee.resigned_on)} tenure</span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href={`/employees/${id}`} />}>Employee profile</Button>
            <Button variant="outline" nativeButton={false} render={<Link href={`/payslips?employee=${id}`} />}>Payslips</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input type="month" className="w-44" value={month} onChange={(e) => setMonth(e.target.value || month)} />
        <span className="text-muted-foreground text-sm">
          {summary.logged} of {summary.workdays} working day(s) logged
        </span>
        <div className="ml-auto flex items-center gap-2">
          {isDraft && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{dirty.size} unsaved change(s)</span>}
          <Button variant="outline" onClick={exportCsv} disabled={!employee}>
            <RiDownloadLine data-icon="inline-start" />
            Export CSV
          </Button>
          <Button onClick={save} disabled={saving || !isDraft}>
            <RiSaveLine data-icon="inline-start" />
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Present days" value={String(summary.present)} hint={`${summary.credit} payroll work days`} />
        <Stat label="Hours worked" value={String(summary.hours)} hint="from check in and check out" />
        <Stat label="Overtime" value={String(summary.ot)} hint="eligible for OT pay" />
        <Stat label="Leave days" value={String(summary.leave)} hint="paid leave credited" />
        <Stat label="Absent days" value={String(summary.absent)} hint="not credited in payroll" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <ChartCard className="lg:col-span-7" title="Daily hours" description="Worked hours and overtime for logged days this month.">
          <BarSeriesChart
            data={chartData}
            xKey="day"
            series={[
              { key: "hours", label: "Hours worked", color: "var(--chart-2)" },
              { key: "ot", label: "OT hours", color: "var(--chart-4)" },
            ]}
            formatAxis={(n) => String(n)}
            height={230}
          />
        </ChartCard>
        <ChartCard className="lg:col-span-5" title="Attendance mix" description={`${monthNames[monthNumber - 1]} ${year}`}>
          <DonutChart
            data={summary.counts}
            centerValue={String(summary.logged)}
            centerLabel="days logged"
            formatValue={(n) => `${n} day(s)`}
            height={220}
          />
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RiCalendarCheckLine className="size-4" />
            Monthly timesheet
          </CardTitle>
          <CardDescription>
            Edit any day, then save. Entries feed payroll work days, overtime and deductions. Sundays are shown for reference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Date</TableHead>
                <TableHead className="w-40">Status</TableHead>
                <TableHead className="w-28">Check in</TableHead>
                <TableHead className="w-28">Check out</TableHead>
                <TableHead className="w-24">OT hours</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((d) => {
                const onDuty = d.status === "present" || d.status === "half_day"
                const future = d.date > today
                const beforeJoin = d.date < employee.join_date
                const disabled = future || beforeJoin || employee.status === "resigned" && !!employee.resigned_on && d.date > employee.resigned_on
                return (
                  <TableRow key={d.date} className={d.weekday === 0 ? "bg-muted/30" : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={disabled ? "text-muted-foreground" : ""}>{fmtDate(d.date)}</span>
                        {d.weekday === 0 && <span className="text-muted-foreground text-[10px] uppercase">Sun</span>}
                        {dirty.has(d.date) && <span className="bg-chart-4 size-1.5 rounded-full" title="Unsaved" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select value={d.status} onValueChange={(v) => setStatus(d, String(v) as Status)} disabled={disabled}>
                        <SelectTrigger className="w-full" size="sm">
                          <SelectValue>{label(d.status)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{label(s)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input type="time" value={d.check_in} disabled={disabled || !onDuty} onChange={(e) => setDay(d.date, { check_in: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input type="time" value={d.check_out} disabled={disabled || !onDuty} onChange={(e) => setDay(d.date, { check_out: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" min="0" step="0.5" value={d.ot_hours} disabled={disabled || !onDuty} onChange={(e) => setDay(d.date, { ot_hours: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input value={d.notes} disabled={disabled} onChange={(e) => setDay(d.date, { notes: e.target.value })} placeholder="Optional note" />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <RiArrowLeftLine className="size-3.5" />
        Work-day credit uses the same rules as payroll: present/leave/holiday = 1, half day = 0.5, absent = 0.
        {employee.join_date > monthStart(year, monthNumber) && ` Joined ${fmtDate(employee.join_date)}.`}
      </p>
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
