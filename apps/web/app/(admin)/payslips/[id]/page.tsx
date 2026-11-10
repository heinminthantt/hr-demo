"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { RiBankCardLine, RiMailSendLine, RiPrinterLine } from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { ChartCard, DonutChart, TrendChart } from "@/components/charts"
import { supabase } from "@/lib/supabase"
import type { AppSettingsRow, EmployeeRow, PayrollRunRow, PayslipRow } from "@/lib/payroll"
import { fmtDate, money, monthNames } from "@/lib/format"
import { initials, monthLabel, tenureLabel } from "@/lib/hr"

type Template = { id: string; name: string; subject: string; body: string }

const grossOf = (p: PayslipRow) =>
  Number(p.basic_amount) + Number(p.ot_amount) + Number(p.allowance) + Number(p.other_bonus)

export default function PayslipDetailPage() {
  const params = useParams<{ id: string }>()
  const id = String(params.id)
  const [slip, setSlip] = useState<PayslipRow | null>(null)
  const [employee, setEmployee] = useState<EmployeeRow | null>(null)
  const [run, setRun] = useState<PayrollRunRow | null>(null)
  const [employeeSlips, setEmployeeSlips] = useState<PayslipRow[]>([])
  const [runs, setRuns] = useState<PayrollRunRow[]>([])
  const [settings, setSettings] = useState<AppSettingsRow | null>(null)
  const [template, setTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    const { data: slipRow } = await supabase.from("payslips").select("*").eq("id", id).maybeSingle()
    if (!slipRow) {
      setNotFound(true)
      setLoading(false)
      return
    }
    const current = slipRow as PayslipRow
    const [{ data: emp }, { data: runRow }, { data: slips }, { data: runRows }, { data: s }, { data: templates }] =
      await Promise.all([
        supabase.from("employees").select("*").eq("id", current.employee_id).maybeSingle(),
        supabase.from("payroll_runs").select("*").eq("id", current.run_id).maybeSingle(),
        supabase.from("payslips").select("*").eq("employee_id", current.employee_id),
        supabase.from("payroll_runs").select("*").order("period_year", { ascending: false }).order("period_month", { ascending: false }),
        supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
        supabase.from("email_templates").select("*").order("name"),
      ])
    const list = (templates as Template[]) ?? []
    setSlip(current)
    setEmployee((emp as EmployeeRow) ?? null)
    setRun((runRow as PayrollRunRow) ?? null)
    setEmployeeSlips((slips as PayslipRow[]) ?? [])
    setRuns((runRows as PayrollRunRow[]) ?? [])
    setSettings((s as AppSettingsRow) ?? null)
    setTemplate(list.find((t) => /payslip/i.test(t.name)) ?? list[0] ?? null)
    setLoading(false)
  }, [id])

  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [load])

  const cur = settings?.currency ?? "MMK"
  const runById = useMemo(() => new Map(runs.map((r) => [r.id, r])), [runs])

  const ytd = useMemo(() => {
    if (!slip || !run) return { gross: 0, deductions: 0, net: 0, employerSsb: 0, count: 0 }
    const sameYear = employeeSlips.filter((p) => {
      const r = runById.get(p.run_id)
      return r?.status === "finalized" && r.period_year === run.period_year
    })
    return {
      gross: sameYear.reduce((s, p) => s + grossOf(p), 0),
      deductions: sameYear.reduce(
        (s, p) => s + Number(p.ssb_employee) + Number(p.pit) + Number(p.absence_deduction) + Number(p.other_deduction),
        0
      ),
      net: sameYear.reduce((s, p) => s + Number(p.net_pay), 0),
      employerSsb: sameYear.reduce((s, p) => s + Number(p.ssb_employer), 0),
      count: sameYear.length,
    }
  }, [employeeSlips, runById, slip, run])

  const trend = useMemo(
    () =>
      employeeSlips
        .map((p) => {
          const r = runById.get(p.run_id)
          return r
            ? { period: `${monthNames[r.period_month - 1]?.slice(0, 3)} ${String(r.period_year).slice(2)}`, net: Number(p.net_pay), ts: `${r.period_year}-${String(r.period_month).padStart(2, "0")}` }
            : null
        })
        .filter((p): p is { period: string; net: number; ts: string } => p !== null)
        .sort((a, b) => a.ts.localeCompare(b.ts))
        .slice(-8),
    [employeeSlips, runById]
  )

  const composition = slip
    ? [
        { name: "Basic", value: Number(slip.basic_amount), color: "#0ea5e9" },
        { name: "Overtime", value: Number(slip.ot_amount), color: "#f59e0b" },
        { name: "Allowance", value: Number(slip.allowance), color: "#8b5cf6" },
        { name: "Bonus", value: Number(slip.other_bonus), color: "#10b981" },
      ].filter((d) => d.value > 0)
    : []

  const openDraft = () => {
    if (!employee?.email || !run || !template || !slip) return
    const values: Record<string, string> = {
      name: employee.name,
      code: employee.employee_code,
      period: `${monthNames[run.period_month - 1]} ${run.period_year}`,
      net: money(Number(slip.net_pay), cur),
      company: "HR Admin",
    }
    const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k: string) => values[k] ?? "")
    const url =
      "https://mail.google.com/mail/?view=cm&fs=1" +
      `&to=${encodeURIComponent(employee.email)}` +
      `&su=${encodeURIComponent(fill(template.subject))}` +
      `&body=${encodeURIComponent(fill(template.body))}`
    window.open(url, "_blank")
  }

  if (loading) return <p className="text-muted-foreground p-6 text-sm">Loading payslip...</p>
  if (notFound || !slip || !employee || !run) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm">This payslip could not be found.</p>
        <Button variant="outline" nativeButton={false} render={<Link href="/payslips" />}>Back to payslips</Button>
      </div>
    )
  }

  const gross = grossOf(slip)
  const totalDeductions = Number(slip.ssb_employee) + Number(slip.pit) + Number(slip.absence_deduction) + Number(slip.other_deduction)

  return (
    <div className="space-y-5">
      <PageHeader
        backHref="/payslips"
        backLabel="Payslips"
        leading={
          <span className="from-primary/25 to-primary/5 text-primary ring-primary/15 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-semibold ring-1">
            {initials(employee.name)}
          </span>
        }
        title={`Payslip - ${monthLabel(run.period_year, run.period_month)}`}
        meta={<StatusBadge status={run.status} />}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href={`/employees/${employee.id}`} className="font-medium hover:underline">{employee.name}</Link>
            <span>·</span>
            <span className="font-mono text-xs">{employee.employee_code}</span>
            <span>·</span>
            <span>{employee.position}</span>
            <span>·</span>
            <span className="text-xs">Run {run.id.slice(0, 16)}</span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href={`/payroll/${run.id}`} />}>
              <RiBankCardLine data-icon="inline-start" />
              Payroll run
            </Button>
            <Button variant="outline" className="print:hidden" onClick={openDraft} disabled={!employee.email || !template}>
              <RiMailSendLine data-icon="inline-start" />
              Gmail draft
            </Button>
            <Button className="print:hidden" onClick={() => window.print()}>
              <RiPrinterLine data-icon="inline-start" />
              Print
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
        <Stat label="Gross pay" value={money(gross, cur)} hint={`${Number(slip.work_days)} work days`} />
        <Stat label="Deductions" value={money(totalDeductions, cur)} hint="SSB, PIT and other" />
        <Stat label="Net pay" value={money(Number(slip.net_pay), cur)} hint={run.status === "finalized" ? "Finalized" : "Draft"} />
        <Stat label={`${run.period_year} net to date`} value={money(ytd.net, cur)} hint={`${ytd.count} finalized payslip(s)`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="payslip-print lg:col-span-7">
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">HR Admin</CardTitle>
                <CardDescription>Yangon, Myanmar</CardDescription>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">Payslip</p>
                <p className="text-muted-foreground text-xs">{monthLabel(run.period_year, run.period_month)}</p>
                <p className="text-muted-foreground font-mono text-[10px]">{slip.id.slice(0, 18)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Employee" value={employee.name} />
              <Info label="Employee code" value={employee.employee_code} />
              <Info label="Position" value={employee.position} />
              <Info label="Department" value={employee.department} />
              <Info label="Joined" value={fmtDate(employee.join_date)} />
              <Info label="Tenure" value={tenureLabel(employee.join_date, employee.resigned_on)} />
              <Info label="Bank NRC" value={employee.nrc_no ?? "-"} />
              <Info label="Work days" value={String(Number(slip.work_days))} />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide">Earnings</p>
                <dl className="space-y-1.5 text-sm">
                  <Row label="Basic pay" value={money(Number(slip.basic_amount), cur)} />
                  <Row label="Overtime" value={money(Number(slip.ot_amount), cur)} muted={!Number(slip.ot_amount)} />
                  <Row label="Allowance" value={money(Number(slip.allowance), cur)} muted={!Number(slip.allowance)} />
                  <Row label="Bonus" value={money(Number(slip.other_bonus), cur)} muted={!Number(slip.other_bonus)} />
                  <Row label="Gross pay" value={money(gross, cur)} strong />
                </dl>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide">Deductions</p>
                <dl className="space-y-1.5 text-sm">
                  <Row label="SSB employee (2%)" value={`- ${money(Number(slip.ssb_employee), cur)}`} muted={!Number(slip.ssb_employee)} />
                  <Row label="Income tax (PIT)" value={`- ${money(Number(slip.pit), cur)}`} muted={!Number(slip.pit)} />
                  <Row label="Absence" value={`- ${money(Number(slip.absence_deduction), cur)}`} muted={!Number(slip.absence_deduction)} />
                  <Row label="Other" value={`- ${money(Number(slip.other_deduction), cur)}`} muted={!Number(slip.other_deduction)} />
                  <Row label="Total deductions" value={`- ${money(totalDeductions, cur)}`} strong />
                </dl>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-3">
              <span className="text-sm font-medium">Net pay</span>
              <span className="text-xl font-semibold tracking-tight">{money(Number(slip.net_pay), cur)}</span>
            </div>
            <p className="text-muted-foreground text-[11px]">
              Employer SSB contribution {money(Number(slip.ssb_employer), cur)} is paid by the company and is not deducted from net pay.
              Generated from the {monthLabel(run.period_year, run.period_month)} payroll run.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-5 print:hidden">
          <ChartCard title="Earnings composition" description={monthLabel(run.period_year, run.period_month)}>
            <DonutChart data={composition} centerValue={money(gross, cur)} centerLabel="gross" formatValue={(n) => money(n, cur)} height={180} />
          </ChartCard>
          <ChartCard title="Net pay trend" description="Finalized payslips, last eight periods.">
            <TrendChart data={trend} xKey="period" series={[{ key: "net", label: "Net pay", color: "var(--chart-2)" }]} formatValue={(n) => money(n, cur)} height={180} />
          </ChartCard>
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>{run.period_year} year to date</CardTitle>
          <CardDescription>Finalized payroll totals for {employee.name}.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Gross" value={money(ytd.gross, cur)} hint="basic, OT, allowance, bonus" />
            <Stat label="Deductions" value={money(ytd.deductions, cur)} hint="employee side" />
            <Stat label="Net paid" value={money(ytd.net, cur)} hint={`${ytd.count} payslip(s)`} />
            <Stat label="Employer SSB" value={money(ytd.employerSsb, cur)} hint="company contribution" />
          </div>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-[10px] uppercase tracking-wide">{label}</p>
      <p className="truncate">{value}</p>
    </div>
  )
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={"flex items-center justify-between gap-3 border-b border-dashed pb-1 last:border-0 " + (muted ? "text-muted-foreground" : "")}>
      <dt className={strong ? "font-medium" : ""}>{label}</dt>
      <dd className={strong ? "font-semibold" : ""}>{value}</dd>
    </div>
  )
}
