"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CrudTable, type CrudOption, type CrudRow } from "@/components/crud-table"
import { PageHeader } from "@/components/page-header"
import { ChartCard, DonutChart, HorizontalBars } from "@/components/charts"
import { supabase } from "@/lib/supabase"
import type { EmployeeRow } from "@/lib/payroll"
import { fmtDate, todayStr } from "@/lib/format"
import { pct } from "@/lib/hr"

type Task = { id: string; title: string; assignee_id: string | null; due_date: string | null; priority: string; status: string }

const STATUS_COLORS: Record<string, string> = { todo: "#64748b", doing: "#f59e0b", done: "#10b981" }
const PRIORITY_COLORS: Record<string, string> = { high: "#ef4444", normal: "#0ea5e9", low: "#64748b" }

const PRIORITIES: CrudOption[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
]

const STATUSES: CrudOption[] = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "In progress" },
  { value: "done", label: "Done" },
]

export default function TeamTasksPage() {
  const [employees, setEmployees] = useState<Pick<EmployeeRow, "id" | "name" | "employee_code">[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  const loadEmployees = useCallback(async () => {
    const [{ data: emps }, { data: taskRows }] = await Promise.all([
      supabase.from("employees").select("id, name, employee_code").eq("status", "active").order("employee_code"),
      supabase.from("tasks").select("id, title, assignee_id, due_date, priority, status").order("due_date"),
    ])
    setEmployees((emps as Pick<EmployeeRow, "id" | "name" | "employee_code">[]) ?? [])
    setTasks((taskRows as Task[]) ?? [])
  }, [])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])
  const empOptions = employees.map((e) => ({ value: e.id, label: `${e.employee_code} - ${e.name}` }))
  const nameOf = (id: string | null) => (id ? (byId.get(id)?.name ?? "(deleted)") : "Unassigned")

  const done = tasks.filter((t) => t.status === "done").length
  const overdue = tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < todayStr()).length
  const doing = tasks.filter((t) => t.status === "doing").length
  const open = tasks.filter((t) => t.status !== "done").length

  const statusMix = STATUSES.map((s) => ({ name: s.label, value: tasks.filter((t) => t.status === s.value).length, color: STATUS_COLORS[s.value] })).filter((d) => d.value > 0)
  const priorityMix = PRIORITIES.map((p) => ({
    label: p.label,
    value: tasks.filter((t) => t.priority === p.value && t.status !== "done").length,
    color: PRIORITY_COLORS[p.value],
    hint: `${tasks.filter((t) => t.priority === p.value && t.status !== "done").length} open task(s)`,
  }))
  const workload = [...byId.values()]
    .map((e) => ({
      label: e.name,
      value: tasks.filter((t) => t.assignee_id === e.id && t.status !== "done").length,
      hint: `${tasks.filter((t) => t.assignee_id === e.id && t.status !== "done").length} open · ${tasks.filter((t) => t.assignee_id === e.id && t.status === "done").length} done`,
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const markDone = async (row: CrudRow, reload: () => Promise<void>) => {
    const { error } = await supabase.from("tasks").update({ status: "done" }).eq("id", row.id)
    if (!error) {
      await reload()
      await loadEmployees()
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team Tasks"
        description="Assign work, track workload and keep due dates under control."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open tasks" value={String(open)} hint={`${doing} in progress`} />
        <Stat label="Overdue" value={String(overdue)} hint="past due and not done" />
        <Stat label="Completed" value={String(done)} hint={`${pct(done, Math.max(1, tasks.length))}% completion rate`} />
        <Stat label="High priority" value={String(tasks.filter((t) => t.priority === "high" && t.status !== "done").length)} hint="open high priority tasks" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <ChartCard className="lg:col-span-4" title="Task status" description={`${tasks.length} task(s) on record.`}>
          <DonutChart data={statusMix} centerValue={String(tasks.length)} centerLabel="tasks" formatValue={(n) => `${n} task(s)`} height={200} />
        </ChartCard>
        <ChartCard className="lg:col-span-4" title="Open tasks by priority" description="Current backlog by priority.">
          <HorizontalBars data={priorityMix} formatValue={(n) => `${n} task(s)`} />
        </ChartCard>
        <ChartCard className="lg:col-span-4" title="Workload by assignee" description="Open tasks per person.">
          {workload.length > 0 ? (
            <HorizontalBars data={workload} formatValue={(n) => `${n} task(s)`} />
          ) : (
            <p className="text-muted-foreground py-10 text-center text-sm">No open tasks assigned.</p>
          )}
        </ChartCard>
      </div>

      <CrudTable
        title="Tasks"
        table="tasks"
        addLabel="+ New task"
        onChanged={loadEmployees}
        fields={[
          { key: "title", label: "Title", required: true },
          { key: "assignee_id", label: "Assignee", type: "select", optionsKey: "employee" },
          { key: "due_date", label: "Due date", type: "date" },
          { key: "priority", label: "Priority", type: "select", optionsKey: "priority", defaultValue: "normal" },
          { key: "status", label: "Status", type: "select", optionsKey: "status", defaultValue: "todo" },
          { key: "notes", label: "Notes", type: "textarea" },
        ]}
        options={{ employee: empOptions, priority: PRIORITIES, status: STATUSES }}
        searchKeys={["title", "notes"]}
        columns={[
          { key: "title", label: "Task" },
          { key: "assignee_id", label: "Assignee", render: (r) => nameOf(r.assignee_id) },
          { key: "due_date", label: "Due", render: (r) => fmtDate(r.due_date) },
          {
            key: "priority",
            label: "Priority",
            render: (r) => (
              <Badge variant={r.priority === "high" ? "default" : "secondary"}>{r.priority}</Badge>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <Badge variant={r.status === "done" ? "secondary" : "default"}>{r.status}</Badge>
            ),
          },
        ]}
        rowActions={(row, reload) =>
          row.status !== "done" ? (
            <Button variant="secondary" size="xs" onClick={() => markDone(row, reload)}>
              Done
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
        <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">{hint}</p>
      </CardContent>
    </Card>
  )
}
