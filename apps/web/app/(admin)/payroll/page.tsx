"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
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
import { supabase } from "@/lib/supabase"
import {
  type AppSettings,
  type AppSettingsRow,
  type AttendanceLite,
  type EmployeeRow,
  type PayrollRunRow,
  type PayslipRow,
  calcPayslip,
  otHoursFrom,
  workDaysFrom,
} from "@/lib/payroll"
import { monthEnd, monthNames, monthStart, money, todayStr } from "@/lib/format"
import { Stub } from "@/components/stub"

type RowState = {
  employee: EmployeeRow
  slipId?: string
  workDays: number
  otHours: number
  allowance: number
  otherBonus: number
  absenceDeduction: number
  otherDeduction: number
}

const currentYear = Number(todayStr().slice(0, 4))
const YEARS = [currentYear - 1, currentYear, currentYear + 1]

const derive = (r: RowState, s: AppSettings) =>
  calcPayslip(
    r.employee,
    r.workDays,
    r.otHours,
    {
      allowance: r.allowance,
      other_bonus: r.otherBonus,
      absence_deduction: r.absenceDeduction,
      other_deduction: r.otherDeduction,
    },
    s
  )

export default function PayrollPage() {
  const [month, setMonth] = useState(Number(todayStr().slice(5, 7)))
  const [year, setYear] = useState(currentYear)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [runs, setRuns] = useState<PayrollRunRow[]>([])
  const [selected, setSelected] = useState<RowState[] | null>(null)
  const [selectedRun, setSelectedRun] = useState<PayrollRunRow | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const loadMeta = useCallback(async () => {
    setBusy(true)
    setError("")
    const [{ data: s }, { data: rs }] = await Promise.all([
      supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("payroll_runs")
        .select("*")
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false }),
    ])
    setSettings((s as unknown as AppSettingsRow) ?? null)
    setRuns((rs as PayrollRunRow[]) ?? [])
    setSelected(null)
    setSelectedRun(null)
    setBusy(false)
  }, [])

  useEffect(() => {
    loadMeta().catch((e) => setError(String(e)))
  }, [loadMeta])

  // Build (or rebuild) a draft from attendance for the selected month
  const buildDraft = useCallback(async (m: number, y: number) => {
    if (!settings) return
    setBusy(true)
    setError("")
    const start = monthStart(y, m)
    const end = monthEnd(y, m)
    const [{ data: emps, error: e1 }, { data: att, error: e2 }, { data: run, error: e3 }] =
      await Promise.all([
        supabase.from("employees").select("*").order("employee_code"),
        supabase
          .from("attendance")
          .select("employee_id, work_date, status, ot_hours")
          .gte("work_date", start)
          .lte("work_date", end),
        supabase
          .from("payroll_runs")
          .select("*")
          .eq("period_month", m)
          .eq("period_year", y)
          .maybeSingle(),
      ])
    if (e1 || e2 || e3) {
      setError(e1?.message ?? e2?.message ?? e3?.message ?? "error")
      setBusy(false)
      return
    }
    if (run) {
      const { data: slips, error: e4 } = await supabase
        .from("payslips")
        .select("*")
        .eq("run_id", (run as PayrollRunRow).id)
      if (e4) {
        setError(e4.message)
        setBusy(false)
        return
      }
      const empList = (emps as EmployeeRow[]) ?? []
      const attRows = (att as AttendanceLite[]) ?? []
      const slipRows = ((slips as PayslipRow[]) ?? []).map((p): RowState | null => {
        const employee = empList.find((e) => e.id === p.employee_id)
        if (!employee) return null // FK on delete restrict should prevent this; guard anyway
        const empAtt = attRows.filter((a) => a.employee_id === p.employee_id)
        return {
          employee,
          slipId: p.id,
          workDays: Number(p.work_days),
          otHours: otHoursFrom(empAtt),
          allowance: Number(p.allowance),
          otherBonus: Number(p.other_bonus),
          absenceDeduction: Number(p.absence_deduction),
          otherDeduction: Number(p.other_deduction),
        }
      })
      setSelected(slipRows.filter((r): r is RowState => r !== null))
      setSelectedRun(run as PayrollRunRow)
      setBusy(false)
      return
    }
    const empList = (emps as EmployeeRow[]) ?? []
    // worked this month if joined before month end and not resigned before month start
    const inPeriod = empList.filter(
      (e) => e.join_date <= end && (!e.resigned_on || e.resigned_on >= start)
    )
    const attRows = (att as AttendanceLite[]) ?? []
    const rows: RowState[] = inPeriod.map((employee) => {
      const empAtt = attRows.filter((a) => a.employee_id === employee.id)
      return {
        employee,
        workDays: workDaysFrom(empAtt),
        otHours: otHoursFrom(empAtt),
        allowance: 0,
        otherBonus: 0,
        absenceDeduction: 0,
        otherDeduction: 0,
      }
    })
    setSelected(rows)
    setSelectedRun(null)
    setBusy(false)
  }, [settings]) // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    if (!selected || !settings) return null
    return selected.reduce(
      (s, r) => {
        const d = derive(r, settings)
        s.basic += d.basic_amount
        s.ot += d.ot_amount
        s.ssbE += d.ssb_employee
        s.ssbR += d.ssb_employer
        s.pit += d.pit
        s.net += d.net_pay
        return s
      },
      { basic: 0, ot: 0, ssbE: 0, ssbR: 0, pit: 0, net: 0 }
    )
  }, [selected, settings])

  // Create the run row (or reuse the existing one) and upsert every payslip
  const saveRun = async (finalize: boolean) => {
    if (!selected || !settings) return
    const isNew = !selected.some((r) => r.slipId)
    let run = selectedRun
    if (!run) {
      const ins = await supabase
        .from("payroll_runs")
        .insert({ period_month: month, period_year: year })
        .select()
        .single()
      if (ins.error) {
        setError(ins.error.message)
        return
      }
      run = ins.data as PayrollRunRow
    }
    const list = selected.map((r) => {
      const d = derive(r, settings!)
      return {
        ...(r.slipId ? { id: r.slipId } : null),
        run_id: run.id,
        employee_id: r.employee.id,
        work_days: d.work_days,
        basic_amount: d.basic_amount,
        ot_amount: d.ot_amount,
        allowance: d.allowance,
        other_bonus: d.other_bonus,
        absence_deduction: d.absence_deduction,
        other_deduction: d.other_deduction,
        ssb_employee: d.ssb_employee,
        ssb_employer: d.ssb_employer,
        pit: d.pit,
        net_pay: d.net_pay,
      }
    })
    const res = await supabase.from("payslips").upsert(list)
    if (res.error) {
      setError(res.error.message)
      return
    }
    if (finalize) {
      const fin = await supabase
        .from("payroll_runs")
        .update({ status: "finalized", finalized_at: new Date().toISOString() })
        .eq("id", run.id)
      if (fin.error) {
        setError(fin.error.message)
        return
      }
    }
    await loadMeta()
    await buildDraft(month, year) // reopen the saved run
  }

  const editable = selectedRun?.status === "draft" || !selectedRun
  if (!settings) return <Stub title="Payroll" what="Loading tax settings." />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Payroll</h1>
          <p className="text-muted-foreground text-sm">
            {runs.length} run(s) on record · {selectedRun ? `viewing ${monthNames[selectedRun.period_month - 1]} ${selectedRun.period_year}` : "no run open"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-36">
              <SelectValue>{monthNames[month - 1]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {monthNames.map((n, i) => (
                <SelectItem key={n} value={String(i + 1)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue>{year}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((yy) => (
                <SelectItem key={yy} value={String(yy)}>
                  {yy}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => buildDraft(month, year)} disabled={busy}>
            {busy ? "Working…" : selectedRun?.period_month === month ? "Reload run" : "Compute / open run"}
          </Button>
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {runs.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Run history</CardTitle>
            <CardDescription>Open any saved run for KPIs, cost charts and payslip links.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {runs.map((r) => (
                <Button key={r.id} variant="outline" size="sm" nativeButton={false} render={<Link href={`/payroll/${r.id}`} />}>
                  {monthNames[r.period_month - 1]} {r.period_year}
                  <Badge variant={r.status === "finalized" ? "secondary" : "default"}>{r.status}</Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!selected && (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Pick a month and press <b>Compute / open run</b>. Existing runs open as-is; new months compute from attendance + current Settings.
          </CardContent>
        </Card>
      )}

      {selected && settings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {monthNames[(selectedRun?.period_month ?? month) - 1]} {selectedRun?.period_year ?? year}
              <Badge variant={selectedRun?.status === "finalized" ? "secondary" : "default"}>
                {selectedRun?.status ?? "new draft"}
              </Badge>
            </CardTitle>
            <CardDescription>
              {editable
                ? "Adjust allowances / deductions per employee - totals recompute live."
                : "Finalized - read-only. Unfinalize in DB required to change."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>OT h</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">OT pay</TableHead>
                  <TableHead className="text-right">Allowance</TableHead>
                  <TableHead className="text-right">Bonus</TableHead>
                  <TableHead className="text-right">Deduction</TableHead>
                  <TableHead className="text-right">SSB (emp.)</TableHead>
                  <TableHead className="text-right">PIT</TableHead>
                  <TableHead className="text-right">Net pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selected.map((r, idx) => {
                  const d = derive(r, settings)
                  const cur = settings.currency
                  return (
                    <TableRow key={r.employee.id}>
                      <TableCell>
                        <Link href={`/employees/${r.employee.id}`} className="text-sm font-medium hover:text-primary hover:underline">{r.employee.name}</Link>
                        <p className="text-muted-foreground font-mono text-xs">{r.employee.employee_code}</p>
                      </TableCell>
                      <TableCell className="text-sm">{r.workDays}</TableCell>
                      <TableCell className="text-sm">{r.otHours}</TableCell>
                      <TableCell className="text-right text-xs">{money(d.basic_amount, cur)}</TableCell>
                      <TableCell className="text-right text-xs">{money(d.ot_amount, cur)}</TableCell>
                      {(["allowance", "otherBonus", "otherDeduction"] as const).map((key) => (
                        <TableCell key={key} className="text-right">
                          {editable ? (
                            <Input
                              type="number"
                              min="0"
                              className="ml-auto w-24 text-right"
                              value={String(r[key])}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0
                                setSelected((prev) =>
                                  prev === null ? prev : prev.map((p) => (p.employee.id === r.employee.id ? { ...p, [key]: val } : p))
                                )
                              }}
                            />
                          ) : (
                            <span className="text-xs">
                              {{
                                allowance: d.allowance,
                                otherBonus: d.other_bonus,
                                otherDeduction: d.other_deduction,
                              }[key] === 0
                                ? "-"
                                : money(
                                    { allowance: d.allowance, otherBonus: d.other_bonus, otherDeduction: d.other_deduction }[key],
                                    cur
                                  )}
                            </span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-xs">{money(d.ssb_employee, cur)}</TableCell>
                      <TableCell className="text-right text-xs">{money(d.pit, cur)}</TableCell>
                      <TableCell className="text-right font-medium">{money(d.net_pay, cur)}</TableCell>
                    </TableRow>
                  )
                })}
                {selected.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-muted-foreground text-center">
                      No eligible employees for this month.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {counts && selected.length > 0 && (
              <div className="text-muted-foreground mt-4 flex flex-wrap justify-end gap-x-6 gap-y-1 text-xs">
                <span>Basic {money(counts.basic, settings.currency)}</span>
                <span>OT {money(counts.ot, settings.currency)}</span>
                <span>SSB emp. {money(counts.ssbE, settings.currency)} / employer {money(counts.ssbR, settings.currency)}</span>
                <span>PIT {money(counts.pit, settings.currency)}</span>
                <span className="text-foreground font-medium">Net {money(counts.net, settings.currency)}</span>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              {editable && (
                <>
                  <Button variant="outline" onClick={() => saveRun(false)} disabled={busy || selected.length === 0}>
                    Save draft
                  </Button>
                  <Button onClick={() => saveRun(true)} disabled={busy || selected.length === 0}>
                    Finalize - lock run
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
