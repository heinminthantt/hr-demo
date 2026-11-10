"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"
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
import { CrudTable } from "@/components/crud-table"
import { supabase } from "@/lib/supabase"
import type { AppSettingsRow, EmployeeRow, PayrollRunRow, PayslipRow } from "@/lib/payroll"
import { money, monthNames } from "@/lib/format"

type Template = { id: string; name: string; subject: string; body: string }

export default function GmailAutomationPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateId, setTemplateId] = useState("")
  const [run, setRun] = useState<PayrollRunRow | null>(null)
  const [slips, setSlips] = useState<PayslipRow[]>([])
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [settings, setSettings] = useState<AppSettingsRow | null>(null)

  const loadTemplates = useCallback(async () => {
    const { data } = await supabase.from("email_templates").select("id, name, subject, body").order("name")
    const list = (data as Template[]) ?? []
    setTemplates(list)
    setTemplateId((cur) =>
      list.some((t) => t.id === cur) ? cur : (list.find((t) => /payslip/i.test(t.name)) ?? list[0])?.id ?? ""
    )
  }, [])

  const loadPayroll = useCallback(async () => {
    const [{ data: runs }, { data: emps }, { data: s }] = await Promise.all([
      supabase
        .from("payroll_runs")
        .select("*")
        .eq("status", "finalized")
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false })
        .limit(1),
      supabase.from("employees").select("*").order("employee_code"),
      supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    ])
    const latest = ((runs as PayrollRunRow[]) ?? [])[0] ?? null
    setRun(latest)
    setEmployees((emps as EmployeeRow[]) ?? [])
    setSettings((s as AppSettingsRow) ?? null)
    if (latest) {
      const { data: slipRows } = await supabase.from("payslips").select("*").eq("run_id", latest.id)
      setSlips((slipRows as PayslipRow[]) ?? [])
    } else {
      setSlips([])
    }
  }, [])

  useEffect(() => {
    loadTemplates().catch(() => setTemplates([]))
    loadPayroll().catch(() => setRun(null))
  }, [loadTemplates, loadPayroll])

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])
  const template = templates.find((t) => t.id === templateId) ?? null
  const cur = settings?.currency ?? "MMK"

  const openDraft = (slip: PayslipRow) => {
    const emp = employeeById.get(slip.employee_id)
    if (!emp?.email || !run || !template) return
    const values: Record<string, string> = {
      name: emp.name,
      code: emp.employee_code,
      period: `${monthNames[run.period_month - 1]} ${run.period_year}`,
      net: money(Number(slip.net_pay), cur),
      company: "HR Admin",
    }
    const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k: string) => values[k] ?? "")
    const url =
      "https://mail.google.com/mail/?view=cm&fs=1" +
      `&to=${encodeURIComponent(emp.email)}` +
      `&su=${encodeURIComponent(fill(template.subject))}` +
      `&body=${encodeURIComponent(fill(template.body))}`
    window.open(url, "_blank")
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-medium">Gmail Automation</h1>
        <p className="text-muted-foreground text-sm">
          Reusable email templates plus prefilled Gmail drafts for the latest payslips.
        </p>
      </div>

      <CrudTable
        title="Email templates"
        table="email_templates"
        addLabel="+ New template"
        onChanged={loadTemplates}
        fields={[
          { key: "name", label: "Template name", required: true },
          { key: "subject", label: "Subject", required: true },
          { key: "body", label: "Body", type: "textarea" },
        ]}
        searchKeys={["name", "subject"]}
        columns={[
          { key: "name", label: "Name" },
          { key: "subject", label: "Subject" },
        ]}
        emptyText="No templates yet."
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Payslip emails</CardTitle>
              <CardDescription>
                {run
                  ? `${monthNames[run.period_month - 1]} ${run.period_year}, ${slips.length} payslip(s)`
                  : "Finalize a payroll run first."}
              </CardDescription>
            </div>
            <Select value={templateId} onValueChange={(v) => setTemplateId(String(v))}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Choose template">
                  {(value: unknown) => templates.find((t) => t.id === value)?.name ?? "Choose template"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Net pay</TableHead>
                <TableHead className="text-right">Draft</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slips.map((p) => {
                const emp = employeeById.get(p.employee_id)
                return (
                  <TableRow key={p.id}>
                    <TableCell>{emp?.name ?? "(deleted)"}</TableCell>
                    <TableCell className="text-xs">{emp?.email ?? "No email"}</TableCell>
                    <TableCell className="text-right text-xs">{money(Number(p.net_pay), cur)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={!emp?.email || !template}
                        onClick={() => openDraft(p)}
                      >
                        Open Gmail draft
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {slips.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center">
                    No finalized payslips yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <p className="text-muted-foreground text-xs">
            Drafts open in Gmail compose with name, period and net pay filled in. Fully automatic sending needs a
            server-side Gmail API job, which this browser-only build does not include.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
