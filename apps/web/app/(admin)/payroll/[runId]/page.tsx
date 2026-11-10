"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { RiCheckDoubleLine, RiDownloadLine, RiMailLine, RiPrinterLine } from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
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
import { ChartCard, DonutChart, HorizontalBars, TrendChart } from "@/components/charts"
import { supabase } from "@/lib/supabase"
import type { AppSettingsRow, EmployeeRow, PayrollRunRow, PayslipRow } from "@/lib/payroll"
import { fmtDate, money } from "@/lib/format"
import { monthLabel, pct } from "@/lib/hr"
import { downloadCsv } from "@/lib/csv"

const grossOf = (p: PayslipRow) => Number(p.basic_amount) + Number(p.ot_amount) + Number(p.allowance) + Number(p.other_bonus)
const sum = (rows: number[]) => rows.reduce((s, n) => s + Number(n || 0), 0)
const periodIndex = (r: PayrollRunRow) => r.period_year * 12 + r.period_month

export default function PayrollRunPage() {
  const params = useParams<{ runId: string }>()
  const router = useRouter()
  const id = String(params.runId)
  const [run, setRun] = useState<PayrollRunRow | null>(null)
  const [slips, setSlips] = useState<PayslipRow[]>([])
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [runs, setRuns] = useState<PayrollRunRow[]>([])
  const [allSlips, setAllSlips] = useState<PayslipRow[]>([])
  const [settings, setSettings] = useState<AppSettingsRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const { data: runRow } = await supabase.from("payroll_runs").select("*").eq("id", id).maybeSingle()
    if (!runRow) {
      setNotFound(true)
      setLoading(false)
      return
    }
    const [{ data: slipRows }, { data: emps }, { data: runRows }, { data: everySlip }, { data: s }] = await Promise.all([
      supabase.from("payslips").select("*").eq("run_id", id),
      supabase.from("employees").select("*").order("employee_code"),
      supabase.from("payroll_runs").select("*").order("period_year", { ascending: false }).order("period_month", { ascending: false }),
      supabase.from("payslips").select("*"),
      supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    ])
    setRun(runRow as PayrollRunRow)
    setSlips((slipRows as PayslipRow[]) ?? [])
    setEmployees((emps as EmployeeRow[]) ?? [])
    setRuns((runRows as PayrollRunRow[]) ?? [])
    setAllSlips((everySlip as PayslipRow[]) ?? [])
    setSettings((s as AppSettingsRow) ?? null)
    setLoading(false)
  }, [id])

  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [load])

  const cur = settings?.currency ?? "MMK"
  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])

  const totals = useMemo(
    () => ({
      gross: sum(slips.map(grossOf)),
      basic: sum(slips.map((p) => p.basic_amount)),
      ot: sum(slips.map((p) => p.ot_amount)),
      allowance: sum(slips.map((p) => p.allowance)),
      bonus: sum(slips.map((p) => p.other_bonus)),
      deductions: sum(slips.map((p) => Number(p.ssb_employee) + Number(p.pit) + Number(p.absence_deduction) + Number(p.other_deduction))),
      ssbEmployee: sum(slips.map((p) => p.ssb_employee)),
      ssbEmployer: sum(slips.map((p) => p.ssb_employer)),
      pit: sum(slips.map((p) => p.pit)),
      net: sum(slips.map((p) => p.net_pay)),
    }),
    [slips]
  )

  const previous = useMemo(() => {
    if (!run) return null
    const earlier = runs
      .filter((r) => r.status === "finalized" && periodIndex(r) < periodIndex(run))
      .sort((a, b) => periodIndex(b) - periodIndex(a))[0]
    if (!earlier) return null
    const previousSlips = allSlips.filter((p) => p.run_id === earlier.id)
    return {
      run: earlier,
      net: sum(previousSlips.map((p) => p.net_pay)),
      employer: sum(previousSlips.map((p) => grossOf(p) + Number(p.ssb_employer))),
      headcount: previousSlips.length,
    }
  }, [run, runs, allSlips])

  const employerCost = totals.gross + totals.ssbEmployer
  const netDelta = previous && previous.net > 0 ? Math.round(((totals.net - previous.net) / previous.net) * 100) : null

  const composition = useMemo(
    () =>
      [
        { name: "Basic", value: totals.basic, color: "#0ea5e9" },
        { name: "Overtime", value: totals.ot, color: "#f59e0b" },
        { name: "Allowance", value: totals.allowance, color: "#8b5cf6" },
        { name: "Bonus", value: totals.bonus, color: "#10b981" },
      ].filter((d) => d.value > 0),
    [totals]
  )

  const departments = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of slips) {
      const emp = byId.get(p.employee_id)
      map.set(emp?.department ?? "Unknown", (map.get(emp?.department ?? "Unknown") ?? 0) + grossOf(p))
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, hint: money(value, cur) }))
  }, [slips, byId, cur])

  const trend = useMemo(() => {
    if (!run) return []
    return runs
      .filter((r) => r.status === "finalized" && periodIndex(r) <= periodIndex(run) && periodIndex(r) > periodIndex(run) - 8)
      .sort((a, b) => periodIndex(a) - periodIndex(b))
      .map((r) => {
        const rows = allSlips.filter((p) => p.run_id === r.id)
        return {
          period: monthLabel(r.period_year, r.period_month).slice(0, 3),
          net: sum(rows.map((p) => p.net_pay)),
          employer: sum(rows.map((p) => grossOf(p) + Number(p.ssb_employer))),
        }
      })
  }, [runs, allSlips, run])

  const exceptions = useMemo(() => {
    const out: { id: string; employee: string; issue: string; href: string }[] = []
    for (const p of slips) {
      const emp = byId.get(p.employee_id)
      const name = emp?.name ?? "(deleted)"
      if (Number(p.work_days) <= 0) out.push({ id: `${p.id}-days`, employee: name, issue: "No payable work days", href: `/payslips/${p.id}` })
      else if (Number(p.net_pay) <= 0) out.push({ id: `${p.id}-net`, employee: name, issue: "Net pay is zero or negative", href: `/payslips/${p.id}` })
      else if (Number(p.ot_amount) > Number(p.basic_amount) * 0.25) out.push({ id: `${p.id}-ot`, employee: name, issue: "Overtime above 25 percent of basic", href: `/payslips/${p.id}` })
    }
    return out
  }, [slips, byId])

  const finalize = async () => {
    if (!run) return
    setBusy(true)
    setError("")
    const res = await supabase
      .from("payroll_runs")
      .update({ status: "finalized", finalized_at: new Date().toISOString() })
      .eq("id", run.id)
    if (res.error) {
      setBusy(false)
      setError(res.error.message)
      return
    }
    await supabase.from("activity_log").insert({
      entity: "payroll_run",
      entity_id: run.id,
      action: "finalized",
      detail: `${monthLabel(run.period_year, run.period_month)} payroll run finalized`,
    })
    setBusy(false)
    await load()
    router.refresh()
  }

  const exportCsv = () => {
    if (!run) return
    downloadCsv(
      `payroll-${run.period_year}-${String(run.period_month).padStart(2, "0")}.csv`,
      [
        "Employee code",
        "Employee",
        "Department",
        "Work days",
        "Basic",
        "Overtime",
        "Allowance",
        "Bonus",
        "Absence deduction",
        "Other deduction",
        "SSB employee",
        "SSB employer",
        "PIT",
        "Net pay",
      ],
      slips
        .slice()
        .sort((a, b) => grossOf(b) - grossOf(a))
        .map((p) => {
          const emp = byId.get(p.employee_id)
          return [
            emp?.employee_code ?? p.employee_id,
            emp?.name ?? "(deleted)",
            emp?.department ?? "",
            Number(p.work_days),
            Number(p.basic_amount),
            Number(p.ot_amount),
            Number(p.allowance),
            Number(p.other_bonus),
            Number(p.absence_deduction),
            Number(p.other_deduction),
            Number(p.ssb_employee),
            Number(p.ssb_employer),
            Number(p.pit),
            Number(p.net_pay),
          ]
        })
    )
  }

  if (loading) return <p className="text-muted-foreground p-6 text-sm">Loading payroll run...</p>
  if (notFound || !run) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm">This payroll run could not be found.</p>
        <Button variant="outline" nativeButton={false} render={<Link href="/payroll" />}>Back to payroll</Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        backHref="/payroll"
        backLabel="Payroll"
        title={monthLabel(run.period_year, run.period_month)}
        meta={<StatusBadge status={run.status} />}
        description={`${slips.length} employee(s) · ${run.status === "finalized" ? `Finalized ${fmtDate(run.finalized_at?.slice(0, 10) ?? null)}` : "Draft run, review before finalizing"}`}
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/gmail-automation" />}>
              <RiMailLine data-icon="inline-start" />
              Payslip emails
            </Button>
            <Button variant="outline" className="print:hidden" onClick={exportCsv} disabled={slips.length === 0}>
              <RiDownloadLine data-icon="inline-start" />
              Export CSV
            </Button>
            <Button variant="outline" className="print:hidden" onClick={() => window.print()}>
              <RiPrinterLine data-icon="inline-start" />
              Print
            </Button>
            {run.status !== "finalized" && (
              <Button onClick={finalize} disabled={busy || slips.length === 0}>
                <RiCheckDoubleLine data-icon="inline-start" />
                {busy ? "Finalizing..." : "Finalize run"}
              </Button>
            )}
          </>
        }
      />

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Employees paid" value={String(slips.length)} hint={`${departments.length} department(s)`} />
        <Stat label="Gross pay" value={money(totals.gross, cur)} hint={`Basic ${money(totals.basic, cur)}`} />
        <Stat label="Net pay" value={money(totals.net, cur)} hint={netDelta === null ? "No previous run to compare" : `${netDelta >= 0 ? "+" : ""}${netDelta}% vs previous run`} />
        <Stat label="Employer cost" value={money(employerCost, cur)} hint={`SSB employer ${money(totals.ssbEmployer, cur)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <ChartCard className="lg:col-span-7" title="Payroll cost trend" description="Net pay and employer cost for the latest finalized runs.">
          <TrendChart
            data={trend}
            xKey="period"
            series={[
              { key: "net", label: "Net pay", color: "var(--chart-2)" },
              { key: "employer", label: "Employer cost", color: "var(--chart-4)" },
            ]}
            formatValue={(n) => money(n, cur)}
            height={250}
          />
        </ChartCard>
        <ChartCard className="lg:col-span-5" title="Earnings composition" description="Gross pay split by component.">
          <DonutChart data={composition} centerValue={money(totals.gross, cur)} centerLabel="gross" formatValue={(n) => money(n, cur)} height={230} />
        </ChartCard>

        <ChartCard className="lg:col-span-5" title="Cost by department" description="Gross pay per department this run.">
          <HorizontalBars data={departments} formatValue={(n) => money(n, cur)} />
        </ChartCard>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Run summary</CardTitle>
            <CardDescription>Deductions and statutory totals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SummaryRow label="Gross pay" value={money(totals.gross, cur)} />
            <SummaryRow label="SSB employee" value={`- ${money(totals.ssbEmployee, cur)}`} />
            <SummaryRow label="Income tax (PIT)" value={`- ${money(totals.pit, cur)}`} />
            <SummaryRow label="Other deductions" value={`- ${money(totals.deductions - totals.ssbEmployee - totals.pit, cur)}`} />
            <SummaryRow label="Net pay" value={money(totals.net, cur)} strong />
            <SummaryRow label="Employer SSB" value={money(totals.ssbEmployer, cur)} muted />
            <div className="border-t pt-3 text-xs">
              <p className="text-muted-foreground">Effective deduction rate</p>
              <p className="text-lg font-semibold">{pct(totals.deductions, Math.max(1, totals.gross))}%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Exceptions</CardTitle>
            <CardDescription>Items to review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {exceptions.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">No exceptions found.</p>}
            {exceptions.map((e) => (
              <Link key={e.id} href={e.href} className="hover:bg-muted block rounded-lg border p-2 transition-colors">
                <p className="text-xs font-medium">{e.employee}</p>
                <p className="text-muted-foreground text-[11px]">{e.issue}</p>
              </Link>
            ))}
            {previous && (
              <div className="border-t pt-2 text-[11px]">
                <p className="text-muted-foreground">Compared with {monthLabel(previous.run.period_year, previous.run.period_month)}</p>
                <p className="mt-0.5">Net {money(totals.net - previous.net, cur)} · {previous.headcount} employee(s)</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payslips</CardTitle>
          <CardDescription>Open a payslip for the full breakdown, or print from the payslip page.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">SSB</TableHead>
                <TableHead className="text-right">PIT</TableHead>
                <TableHead className="text-right">Net pay</TableHead>
                <TableHead className="text-right">Payslip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slips
                .slice()
                .sort((a, b) => grossOf(b) - grossOf(a))
                .map((p) => {
                  const emp = byId.get(p.employee_id)
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/employees/${p.employee_id}`} className="text-sm font-medium hover:text-primary hover:underline">{emp?.name ?? "(deleted)"}</Link>
                        <p className="text-muted-foreground font-mono text-xs">{emp?.employee_code ?? "-"}</p>
                      </TableCell>
                      <TableCell className="text-sm">{emp?.department ?? "-"}</TableCell>
                      <TableCell className="text-right text-sm">{Number(p.work_days)}</TableCell>
                      <TableCell className="text-right text-xs">{money(grossOf(p), cur)}</TableCell>
                      <TableCell className="text-right text-xs">{money(Number(p.ssb_employee), cur)}</TableCell>
                      <TableCell className="text-right text-xs">{money(Number(p.pit), cur)}</TableCell>
                      <TableCell className="text-right font-medium">{money(Number(p.net_pay), cur)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="xs" nativeButton={false} render={<Link href={`/payslips/${p.id}`} />}>View</Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              {slips.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-muted-foreground text-center">No payslips in this run.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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

function SummaryRow({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={"flex items-center justify-between gap-3 text-sm " + (muted ? "text-muted-foreground" : "")}>
      <span>{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  )
}
