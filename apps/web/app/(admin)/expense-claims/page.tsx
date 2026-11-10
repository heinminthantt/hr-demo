"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { RiDownloadLine } from "@remixicon/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CrudTable, type CrudOption, type CrudRow } from "@/components/crud-table"
import { PageHeader } from "@/components/page-header"
import { ChartCard, DonutChart, HorizontalBars, TrendChart } from "@/components/charts"
import { supabase } from "@/lib/supabase"
import type { EmployeeRow } from "@/lib/payroll"
import { fmtDate, money, todayStr } from "@/lib/format"
import { recentMonths } from "@/lib/hr"
import { downloadCsv } from "@/lib/csv"
import { logActivity } from "@/lib/activity"

type Claim = {
  id: string
  employee_id: string
  claim_date: string
  category: string
  description: string | null
  amount: number
  status: string
}

const CATEGORY_COLORS: Record<string, string> = {
  travel: "#0ea5e9",
  meals: "#f59e0b",
  supplies: "#8b5cf6",
  fuel: "#10b981",
  other: "#64748b",
}
const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  approved: "#0ea5e9",
  reimbursed: "#10b981",
  rejected: "#ef4444",
}
const sum = (rows: number[]) => rows.reduce((s, n) => s + Number(n || 0), 0)

const CATEGORIES: CrudOption[] = [
  { value: "travel", label: "Travel" },
  { value: "meals", label: "Meals" },
  { value: "supplies", label: "Supplies" },
  { value: "fuel", label: "Fuel" },
  { value: "other", label: "Other" },
]

const STATUSES: CrudOption[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "reimbursed", label: "Reimbursed" },
  { value: "rejected", label: "Rejected" },
]

export default function ExpenseClaimsPage() {
  const [employees, setEmployees] = useState<Pick<EmployeeRow, "id" | "name" | "employee_code">[]>([])
  const [claims, setClaims] = useState<Claim[]>([])

  const loadEmployees = useCallback(async () => {
    const [{ data: emps }, { data: claimRows }] = await Promise.all([
      supabase.from("employees").select("id, name, employee_code").eq("status", "active").order("employee_code"),
      supabase.from("expense_claims").select("id, employee_id, claim_date, category, description, amount, status").order("claim_date", { ascending: false }),
    ])
    setEmployees((emps as Pick<EmployeeRow, "id" | "name" | "employee_code">[]) ?? [])
    setClaims((claimRows as Claim[]) ?? [])
  }, [])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  const claimed = claims.filter((c) => c.status !== "rejected")
  const totalClaimed = sum(claimed.map((c) => c.amount))
  const pending = claims.filter((c) => c.status === "pending")
  const reimbursed = claims.filter((c) => c.status === "reimbursed")

  const statusMix = STATUSES.map((s) => ({ name: s.value, value: claims.filter((c) => c.status === s.value).length, color: STATUS_COLORS[s.value] })).filter((d) => d.value > 0)

  const categorySpend = CATEGORIES.map((c) => ({
    label: c.label,
    value: sum(claimed.filter((row) => row.category === c.value).map((row) => row.amount)),
    color: CATEGORY_COLORS[c.value],
  }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  const monthly = recentMonths(6).map(({ label, key }) => ({
    month: label.slice(0, 3),
    amount: sum(claimed.filter((c) => c.claim_date.startsWith(key)).map((c) => c.amount)),
  }))

  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])
  const empOptions = employees.map((e) => ({ value: e.id, label: `${e.employee_code} - ${e.name}` }))
  const nameOf = (id: string) => byId.get(id)?.name ?? "(deleted)"

  const decide = async (row: CrudRow, status: string, reload: () => Promise<void>) => {
    const { error } = await supabase.from("expense_claims").update({ status }).eq("id", row.id)
    if (!error) {
      await logActivity(
        "expense_claim",
        String(row.id),
        status,
        `${nameOf(String(row.employee_id))} ${row.category} claim ${status} (${money(Number(row.amount))})`
      )
      await reload()
      await loadEmployees()
    }
  }

  const exportClaims = () => {
    downloadCsv(
      `expense-claims-${todayStr()}.csv`,
      ["Employee code", "Employee", "Date", "Category", "Description", "Amount", "Status"],
      claims.map((c) => {
        const emp = byId.get(c.employee_id)
        return [emp?.employee_code ?? c.employee_id, emp?.name ?? "(deleted)", c.claim_date, c.category, c.description, c.amount, c.status]
      })
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Expense Claims"
        description="Submit, approve and reimburse staff expenses, with category and status analytics."
        actions={
          <Button variant="outline" onClick={exportClaims} disabled={claims.length === 0}>
            <RiDownloadLine data-icon="inline-start" />
            Export CSV
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Claimed, excluding rejected" value={money(totalClaimed)} hint={`${claimed.length} claim(s)`} />
        <Stat label="Pending approval" value={money(sum(pending.map((c) => c.amount)))} hint={`${pending.length} claim(s) waiting`} />
        <Stat label="Reimbursed" value={money(sum(reimbursed.map((c) => c.amount)))} hint={`${reimbursed.length} claim(s) paid out`} />
        <Stat label="Average claim" value={money(totalClaimed / Math.max(1, claimed.length))} hint="across accepted claims" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <ChartCard className="lg:col-span-5" title="Claim status" description="Where claims sit in the approval flow.">
          <DonutChart data={statusMix} centerValue={String(claims.length)} centerLabel="claims" formatValue={(n) => `${n} claim(s)`} height={200} />
        </ChartCard>
        <ChartCard className="lg:col-span-4" title="Spend by category" description="Accepted claims, excluding rejected.">
          <HorizontalBars data={categorySpend} formatValue={(n) => money(n)} />
        </ChartCard>
        <ChartCard className="lg:col-span-3" title="Monthly spend" description="Last six months.">
          <TrendChart data={monthly} xKey="month" series={[{ key: "amount", label: "Claimed", color: "var(--chart-4)" }]} formatValue={(n) => money(n)} height={200} />
        </ChartCard>
      </div>

      <CrudTable
        title="Claims"
        table="expense_claims"
        addLabel="+ New claim"
        onChanged={loadEmployees}
        onSaved={async (next, previous) => {
          const detail = `${nameOf(String(next.employee_id))} ${next.category} claim (${money(Number(next.amount))})`
          if (!previous) {
            await logActivity("expense_claim", String(next.id), "created", `${detail} submitted`)
          } else if (previous.status !== next.status) {
            await logActivity("expense_claim", String(next.id), String(next.status), `${detail} ${next.status}`)
          }
        }}
        fields={[
          { key: "employee_id", label: "Employee", type: "select", optionsKey: "employee", required: true },
          { key: "claim_date", label: "Date", type: "date", required: true, defaultValue: todayStr() },
          { key: "category", label: "Category", type: "select", optionsKey: "category", defaultValue: "other" },
          { key: "amount", label: "Amount (MMK)", type: "number", defaultValue: 0 },
          { key: "status", label: "Status", type: "select", optionsKey: "status", defaultValue: "pending" },
          { key: "description", label: "Description", type: "textarea" },
        ]}
        options={{ employee: empOptions, category: CATEGORIES, status: STATUSES }}
        searchKeys={["description"]}
        columns={[
          { key: "employee_id", label: "Employee", render: (r) => nameOf(r.employee_id) },
          { key: "claim_date", label: "Date", render: (r) => fmtDate(r.claim_date) },
          {
            key: "category",
            label: "Category",
            render: (r) => CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category,
          },
          { key: "description", label: "Description" },
          { key: "amount", label: "Amount", align: "right", render: (r) => money(Number(r.amount)) },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <Badge variant={r.status === "reimbursed" ? "secondary" : "default"}>{r.status}</Badge>
            ),
          },
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
          ) : row.status === "approved" ? (
            <Button variant="secondary" size="xs" onClick={() => decide(row, "reimbursed", reload)}>
              Reimburse
            </Button>
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
        <p className="mt-1 truncate text-xl font-semibold tracking-tight">{value}</p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">{hint}</p>
      </CardContent>
    </Card>
  )
}
