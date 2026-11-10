"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  RiArrowRightSLine,
  RiCheckboxCircleLine,
  RiFileList2Line,
  RiFileWarningLine,
  RiNotification3Line,
  RiWalletLine,
} from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { supabase } from "@/lib/supabase"
import type { EmployeeRow } from "@/lib/payroll"
import { daysUntil, type EmployeeDocumentRow, type ExpenseClaimRow, type LeaveRequestRow, type TaskRow } from "@/lib/hr"

type Notice = { id: string; title: string; sub: string; href: string; kind: "leave" | "claim" | "task" | "document" }

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notices, setNotices] = useState<Notice[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ data: leave }, { data: claims }, { data: tasks }, { data: docs }, { data: emps }] = await Promise.all([
        supabase.from("leave_requests").select("*").eq("status", "pending"),
        supabase.from("expense_claims").select("*").eq("status", "pending"),
        supabase.from("tasks").select("*"),
        supabase.from("employee_documents").select("*"),
        supabase.from("employees").select("id, name, employee_code"),
      ])
      if (cancelled) return
      const people = new Map(((emps as Pick<EmployeeRow, "id" | "name">[]) ?? []).map((e) => [e.id, e.name]))
      const next: Notice[] = []
      for (const l of (leave as LeaveRequestRow[]) ?? []) {
        next.push({
          id: `leave-${l.id}`,
          title: `${people.get(l.employee_id) ?? "Employee"} requested ${l.leave_type} leave`,
          sub: `${l.start_date} to ${l.end_date} · ${l.days} day(s)`,
          href: "/forms",
          kind: "leave",
        })
      }
      for (const c of (claims as ExpenseClaimRow[]) ?? []) {
        next.push({
          id: `claim-${c.id}`,
          title: c.description ?? "Expense claim",
          sub: `${people.get(c.employee_id) ?? "Employee"} · ${c.category} · ${Number(c.amount).toLocaleString()} MMK`,
          href: "/expense-claims",
          kind: "claim",
        })
      }
      const soon = new Date()
      soon.setDate(soon.getDate() + 7)
      const soonStr = soon.toISOString().slice(0, 10)
      for (const t of (tasks as TaskRow[]) ?? []) {
        if (t.status === "done" || !t.due_date || t.due_date > soonStr) continue
        next.push({
          id: `task-${t.id}`,
          title: t.title,
          sub: t.due_date < new Date().toISOString().slice(0, 10) ? "Overdue task" : `Due ${t.due_date}`,
          href: "/team-tasks",
          kind: "task",
        })
      }
      for (const d of (docs as EmployeeDocumentRow[]) ?? []) {
        const days = daysUntil(d.expires_on)
        if (days === null || days > 60) continue
        next.push({
          id: `doc-${d.id}`,
          title: d.name,
          sub: `${people.get(d.employee_id) ?? "Employee"} · ${days < 0 ? `expired ${Math.abs(days)}d ago` : `expires in ${days}d`}`,
          href: `/employees/${d.employee_id}`,
          kind: "document",
        })
      }
      setNotices(next)
    })().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const groups = useMemo(
    () => [
      { key: "leave" as const, label: "Leave approvals", icon: RiFileList2Line },
      { key: "claim" as const, label: "Expense approvals", icon: RiWalletLine },
      { key: "task" as const, label: "Task due dates", icon: RiCheckboxCircleLine },
      { key: "document" as const, label: "Document expiry", icon: RiFileWarningLine },
    ],
    []
  )

  return (
    <>
      <Button variant="ghost" size="icon" className="relative" onClick={() => setOpen(true)} aria-label="Notifications">
        <RiNotification3Line />
        {notices.length > 0 && (
          <span className="bg-destructive text-destructive-foreground absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4">
            {notices.length > 9 ? "9+" : notices.length}
          </span>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Needs attention</DialogTitle>
            <DialogDescription>Approvals, due tasks and documents expiring in the next 60 days.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[420px] space-y-4 overflow-y-auto">
            {notices.length === 0 && <p className="text-muted-foreground py-8 text-center text-sm">All clear.</p>}
            {groups.map(({ key, label, icon: Icon }) => {
              const rows = notices.filter((n) => n.kind === key)
              if (rows.length === 0) return null
              return (
                <div key={key} className="space-y-1">
                  <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide">
                    <Icon className="size-3.5" />
                    {label}
                  </p>
                  {rows.map((n) => (
                    <Link
                      key={n.id}
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="hover:bg-muted flex items-center gap-3 rounded-lg px-2 py-2 transition-colors"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{n.title}</span>
                        <span className="text-muted-foreground block truncate text-xs">{n.sub}</span>
                      </span>
                      <RiArrowRightSLine className="text-muted-foreground size-4 shrink-0" />
                    </Link>
                  ))}
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
