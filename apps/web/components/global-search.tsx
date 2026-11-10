"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  RiBankCardLine,
  RiBarChartBoxLine,
  RiCalendarCheckLine,
  RiCarLine,
  RiFileList2Line,
  RiHome5Line,
  RiMailLine,
  RiReceiptLine,
  RiSearchLine,
  RiSettings3Line,
  RiTeamLine,
  RiUser3Line,
  RiUserSearchLine,
  RiWalletLine,
} from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { supabase } from "@/lib/supabase"
import type { EmployeeRow, PayrollRunRow } from "@/lib/payroll"
import { monthLabel } from "@/lib/hr"

type Item = { id: string; label: string; sub: string; href: string; group: string }

const STATIC_ITEMS: Item[] = [
  { id: "nav-home", label: "Overview", sub: "Dashboard and alerts", href: "/", group: "Pages" },
  { id: "nav-employees", label: "Employees", sub: "People directory", href: "/employees", group: "Pages" },
  { id: "nav-attendance", label: "Attendance", sub: "Daily register and timesheets", href: "/attendance", group: "Pages" },
  { id: "nav-forms", label: "Forms", sub: "Leave requests", href: "/forms", group: "Pages" },
  { id: "nav-tasks", label: "Team Tasks", sub: "Work queue", href: "/team-tasks", group: "Pages" },
  { id: "nav-payroll", label: "Payroll", sub: "Runs and adjustments", href: "/payroll", group: "Pages" },
  { id: "nav-payslips", label: "Payslips", sub: "Finalized payslips", href: "/payslips", group: "Pages" },
  { id: "nav-reports", label: "Reports", sub: "Headcount, attendance, payroll", href: "/reports", group: "Pages" },
  { id: "nav-recruitment", label: "Recruitment", sub: "Jobs and applicants", href: "/recruitment", group: "Pages" },
  { id: "nav-vehicles", label: "Fuel and Vehicles", sub: "Fleet and fuel logs", href: "/fuel-vehicles", group: "Pages" },
  { id: "nav-claims", label: "Expense Claims", sub: "Claims and reimbursement", href: "/expense-claims", group: "Pages" },
  { id: "nav-gmail", label: "Gmail Automation", sub: "Templates and drafts", href: "/gmail-automation", group: "Pages" },
  { id: "nav-settings", label: "Settings", sub: "Payroll rules and appearance", href: "/settings", group: "Pages" },
]

const NAV_ICONS: Record<string, typeof RiHome5Line> = {
  Overview: RiHome5Line,
  Employees: RiUser3Line,
  Attendance: RiCalendarCheckLine,
  Forms: RiFileList2Line,
  "Team Tasks": RiTeamLine,
  Payroll: RiBankCardLine,
  Payslips: RiReceiptLine,
  Reports: RiBarChartBoxLine,
  Recruitment: RiUserSearchLine,
  "Fuel and Vehicles": RiCarLine,
  "Expense Claims": RiWalletLine,
  "Gmail Automation": RiMailLine,
  Settings: RiSettings3Line,
}

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [items, setItems] = useState<Item[]>(STATIC_ITEMS)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      const [{ data: emps }, { data: runs }, { data: jobs }, { data: applicants }, { data: claims }, { data: vehicles }] =
        await Promise.all([
          supabase.from("employees").select("id, name, employee_code, department, status").order("employee_code"),
          supabase.from("payroll_runs").select("*").order("period_year", { ascending: false }).order("period_month", { ascending: false }).limit(12),
          supabase.from("job_posts").select("id, title, department, status").order("created_at", { ascending: false }),
          supabase.from("applicants").select("id, name, stage").order("applied_on", { ascending: false }).limit(20),
          supabase.from("expense_claims").select("id, description, category, status").order("claim_date", { ascending: false }).limit(20),
          supabase.from("vehicles").select("id, plate_no, model, status").order("plate_no"),
        ])
      if (cancelled) return
      const next: Item[] = [...STATIC_ITEMS]
      for (const e of (emps as Pick<EmployeeRow, "id" | "name" | "employee_code" | "department" | "status">[]) ?? []) {
        next.push({ id: `emp-${e.id}`, label: e.name, sub: `${e.employee_code} · ${e.department} · ${e.status}`, href: `/employees/${e.id}`, group: "Employees" })
      }
      for (const r of (runs as PayrollRunRow[]) ?? []) {
        next.push({ id: `run-${r.id}`, label: monthLabel(r.period_year, r.period_month), sub: `Payroll run · ${r.status}`, href: `/payroll/${r.id}`, group: "Payroll runs" })
      }
      for (const j of (jobs as { id: string; title: string; department: string; status: string }[]) ?? []) {
        next.push({ id: `job-${j.id}`, label: j.title, sub: `${j.department} · ${j.status}`, href: "/recruitment", group: "Recruitment" })
      }
      for (const a of (applicants as { id: string; name: string; stage: string }[]) ?? []) {
        next.push({ id: `app-${a.id}`, label: a.name, sub: `Applicant · ${a.stage}`, href: "/recruitment", group: "Recruitment" })
      }
      for (const c of (claims as { id: string; description: string | null; category: string; status: string }[]) ?? []) {
        next.push({ id: `claim-${c.id}`, label: c.description ?? "Expense claim", sub: `${c.category} · ${c.status}`, href: "/expense-claims", group: "Expense claims" })
      }
      for (const v of (vehicles as { id: string; plate_no: string; model: string | null; status: string }[]) ?? []) {
        next.push({ id: `veh-${v.id}`, label: v.plate_no, sub: `${v.model ?? "Vehicle"} · ${v.status}`, href: "/fuel-vehicles", group: "Vehicles" })
      }
      setItems(next)
    })().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [open])

  const query = q.trim().toLowerCase()
  const filtered = query
    ? items.filter((i) => `${i.label} ${i.sub} ${i.group}`.toLowerCase().includes(query))
    : items.filter((i) => i.group === "Pages").slice(0, 8)
  const groups = [...new Set(filtered.map((i) => i.group))]
  const first = filtered[0]

  const go = (href: string) => {
    setOpen(false)
    setQ("")
    router.push(href)
  }

  return (
    <>
      <Button
        variant="outline"
        className="text-muted-foreground hidden w-56 justify-start gap-2 font-normal md:flex"
        onClick={() => setOpen(true)}
      >
        <RiSearchLine className="size-4" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="bg-muted text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Search">
        <RiSearchLine />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>Search employees, payroll runs, jobs, claims and vehicles.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 border-b px-3">
            <RiSearchLine className="text-muted-foreground size-4 shrink-0" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && first) go(first.href)
              }}
              placeholder="Search people, payroll, jobs, claims, vehicles"
              className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <kbd className="bg-muted text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2">
            {filtered.length === 0 && <p className="text-muted-foreground p-6 text-center text-sm">No matches.</p>}
            {groups.map((group) => (
              <div key={group} className="mb-2">
                <p className="text-muted-foreground px-2 py-1 text-[11px] font-medium uppercase tracking-wide">{group}</p>
                {filtered
                  .filter((i) => i.group === group)
                  .slice(0, 6)
                  .map((i) => {
                    const Icon = NAV_ICONS[i.label] ?? (i.group === "Employees" ? RiUser3Line : RiSearchLine)
                    return (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => go(i.href)}
                        className="hover:bg-muted flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors"
                      >
                        <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{i.label}</span>
                          <span className="text-muted-foreground block truncate text-xs">{i.sub}</span>
                        </span>
                      </button>
                    )
                  })}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
