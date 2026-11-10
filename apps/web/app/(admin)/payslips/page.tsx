"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
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
import type { AppSettingsRow, EmployeeRow, PayrollRunRow, PayslipRow } from "@/lib/payroll"
import { fmtDate, money, monthNames } from "@/lib/format"

type SlipWithEmployee = PayslipRow & { employee: EmployeeRow | null }

export default function PayslipsPage() {
  const [runs, setRuns] = useState<PayrollRunRow[]>([])
  const [runId, setRunId] = useState("")
  const [settings, setSettings] = useState<AppSettingsRow | null>(null)
  const [slips, setSlips] = useState<SlipWithEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [printing, setPrinting] = useState<SlipWithEmployee | null>(null)
  const [employeeFilter, setEmployeeFilter] = useState("")

  useEffect(() => {
    const employee = new URLSearchParams(window.location.search).get("employee")
    if (employee) setEmployeeFilter(employee)
  }, [])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const [{ data: rs, error: e1 }, { data: s }] = await Promise.all([
        supabase
          .from("payroll_runs")
          .select("*")
          .eq("status", "finalized")
          .order("period_year", { ascending: false })
          .order("period_month", { ascending: false }),
        supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
      ])
      if (e1) setError(e1.message)
      const list = (rs as PayrollRunRow[]) ?? []
      setRuns(list)
      if (list[0]) setRunId(list[0].id)
      setSettings((s as unknown as AppSettingsRow) ?? null)
      setLoading(false)
    })().catch(() => setLoading(false))
  }, [])

  const loadSlips = useCallback(async (rid: string) => {
    setLoading(true)
    setError("")
    const [{ data: slipRows, error: e1 }, { data: empRows }] = await Promise.all([
      supabase.from("payslips").select("*").eq("run_id", rid).order("employee_id"),
      supabase.from("employees").select("*").order("employee_code"),
    ])
    if (e1) setError(e1.message)
    const emps = (empRows as EmployeeRow[]) ?? []
    setSlips(
      ((slipRows as PayslipRow[]) ?? []).map((p) => ({
        ...p,
        employee: emps.find((e) => e.id === p.employee_id) ?? null,
      }))
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    if (runId) loadSlips(runId).catch(() => setLoading(false))
  }, [runId, loadSlips])

  const run = runs.find((r) => r.id === runId)
  const cur = settings?.currency ?? "MMK"
  const company = "HR Admin" // TODO: company name setting when branding matters
  const visibleSlips = employeeFilter ? slips.filter((p) => p.employee_id === employeeFilter) : slips
  const filterName = visibleSlips[0]?.employee?.name

  const slipCard = (p: SlipWithEmployee, d: PayslipRow) => (
    <div className="text-sm">
      <div className="flex items-start justify-between border-b pb-3">
        <div>
          <p className="text-base font-medium">{company}</p>
          <p className="text-muted-foreground text-xs">Payslip</p>
        </div>
        <div className="text-right text-xs">
          <p>{run ? `${monthNames[run.period_month - 1]} ${run.period_year}` : ""}</p>
          <p>Finalized: {fmtDate(run?.finalized_at?.slice(0, 10) ?? null)}</p>
        </div>
      </div>
      <div className="grid gap-1 py-3 text-xs">
        <p><b>Employee:</b> {p.employee?.name ?? "(deleted)"} · <span className="font-mono">{p.employee?.employee_code}</span></p>
        <p><b>Department:</b> {p.employee?.department ?? "-"} · <b>Position:</b> {p.employee?.position ?? "-"} · <b>Work days:</b> {Number(d.work_days)}</p>
      </div>
      <Table>
        <TableBody>
          <TableRow><TableHead>Basic pay</TableHead><TableCell className="text-right">{money(Number(d.basic_amount), cur)}</TableCell></TableRow>
          <TableRow><TableHead>Overtime pay</TableHead><TableCell className="text-right">{money(Number(d.ot_amount), cur)}</TableCell></TableRow>
          <TableRow><TableHead>Allowance</TableHead><TableCell className="text-right">{Number(d.allowance) ? money(Number(d.allowance), cur) : "-"}</TableCell></TableRow>
          <TableRow><TableHead>Bonus</TableHead><TableCell className="text-right">{Number(d.other_bonus) ? money(Number(d.other_bonus), cur) : "-"}</TableCell></TableRow>
          <TableRow><TableHead>SSB employee (2%)</TableHead><TableCell className="text-right">-{money(Number(d.ssb_employee), cur)}</TableCell></TableRow>
          <TableRow><TableHead>SSB employer</TableHead><TableCell className="text-right text-muted-foreground">{money(Number(d.ssb_employer), cur)} (not deducted)</TableCell></TableRow>
          <TableRow><TableHead>Income tax (PIT)</TableHead><TableCell className="text-right">-{money(Number(d.pit), cur)}</TableCell></TableRow>
          <TableRow><TableHead>Other deductions</TableHead><TableCell className="text-right">{Number(d.other_deduction) || Number(d.absence_deduction) ? `-${money(Number(d.absence_deduction) + Number(d.other_deduction), cur)}` : "-"}</TableCell></TableRow>
          <TableRow><TableHead className="font-medium">Net pay</TableHead><TableCell className="text-right font-medium">{money(Number(d.net_pay), cur)}</TableCell></TableRow>
        </TableBody>
      </Table>
      <p className="text-muted-foreground mt-3 text-[10px]">
        SSB rates & PIT brackets per company Settings at time of run. This is a system-generated payslip.
      </p>
    </div>
  )

  const printCss = `@media print{body *{visibility:hidden}#print-slip,#print-slip *{visibility:visible}#print-slip{position:absolute;left:0;top:0;width:100%}}`

  return (
    <div className="space-y-4">
      <style>{printCss}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Payslips</h1>
          <p className="text-muted-foreground text-sm">Finalized payroll runs only.</p>
        </div>
        <Select value={runId} onValueChange={(v) => setRunId(String(v))}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder={loading ? "Loading…" : "Select a run"}>
              {(value: unknown) => {
                const selected = runs.find((r) => r.id === value)
                return selected ? `${monthNames[selected.period_month - 1]} ${selected.period_year}` : loading ? "Loading…" : "Select a run"
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {runs.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {monthNames[r.period_month - 1]} {r.period_year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>{run ? `${monthNames[run.period_month - 1]} ${run.period_year}` : "Select a run"}</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            {visibleSlips.length} payslip(s)
            {employeeFilter && (
              <span className="bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                {filterName ?? "Filtered employee"}
                <button type="button" className="hover:text-foreground text-muted-foreground" onClick={() => setEmployeeFilter("")}>
                  Clear
                </button>
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {visibleSlips.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Work days</TableHead>
                  <TableHead className="text-right">SSB</TableHead>
                  <TableHead className="text-right">PIT</TableHead>
                  <TableHead className="text-right">Net pay</TableHead>
                  <TableHead className="text-right">Print</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleSlips.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/payslips/${p.id}`} className="text-sm font-medium hover:text-primary hover:underline">{p.employee?.name ?? "(deleted)"}</Link>
                      <p className="text-muted-foreground font-mono text-xs">{p.employee?.employee_code ?? "-"}</p>
                    </TableCell>
                    <TableCell className="text-sm">{Number(p.work_days)}</TableCell>
                    <TableCell className="text-right text-xs">{money(Number(p.ssb_employee), cur)}</TableCell>
                    <TableCell className="text-right text-xs">{money(Number(p.pit), cur)}</TableCell>
                    <TableCell className="text-right font-medium">{money(Number(p.net_pay), cur)}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button variant="outline" size="xs" nativeButton={false} render={<Link href={`/payslips/${p.id}`} />}>
                        View
                      </Button>
                      <Button variant="outline" size="xs" onClick={() => setPrinting(p)}>
                        Print
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && visibleSlips.length === 0 && (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {runs.length === 0
                ? "No finalized payroll runs yet - finalize a run in Payroll first."
                : employeeFilter
                  ? "This employee has no payslip in the selected run."
                  : "This run has no payslips."}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!printing} onOpenChange={(o) => !o && setPrinting(null)}>
        <DialogContent className="print-slip max-w-md" id="print-slip">
          <DialogHeader>
            <DialogTitle>Payslip preview</DialogTitle>
          </DialogHeader>
          {printing && slipCard(printing, printing)}
          <DialogFooter>
            <Badge variant="secondary">print-ready</Badge>
            <Button className="print:hidden" onClick={() => setPrinting(null)}>
              Close
            </Button>
            <Button onClick={() => window.print()}>Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
