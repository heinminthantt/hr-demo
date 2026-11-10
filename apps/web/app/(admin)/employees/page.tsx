"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { EmployeeRow } from "@/lib/payroll"
import { fmtDate, money } from "@/lib/format"
import { seedLeaveBalances } from "@/lib/leave"
import { logActivity } from "@/lib/activity"

const blankForm = {
  employee_code: "",
  name: "",
  nrc_no: "",
  phone: "",
  email: "",
  address: "",
  department: "General",
  position: "Staff",
  employment_type: "full_time",
  join_date: "",
  base_salary: "0",
  ot_eligible: true,
  status: "active",
  resigned_on: "",
}

type Form = typeof blankForm

export default function EmployeesPage() {
  const [rows, setRows] = useState<EmployeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(blankForm)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from("employees")
      .select("*")
      .order("employee_code")
    if (err) setError(err.message)
    setRows((data as EmployeeRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [load])

  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        `${r.employee_code} ${r.name} ${r.department} ${r.position}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [rows, search]
  )

  const nextCode = useMemo(() => {
    const max = rows.reduce((m, r) => Math.max(m, Number(r.employee_code.replace(/\D/g, "")) || 0), 0)
    return `EMP-${String(max + 1).padStart(3, "0")}`
  }, [rows])

  const openAdd = () => {
    setEditingId(null)
    setForm({ ...blankForm, employee_code: nextCode, join_date: new Date().toISOString().slice(0, 10) })
    setError("")
    setOpen(true)
  }

  const openEdit = (r: EmployeeRow) => {
    setEditingId(r.id)
    setForm({
      employee_code: r.employee_code,
      name: r.name,
      nrc_no: r.nrc_no ?? "",
      phone: r.phone ?? "",
      email: r.email ?? "",
      address: r.address ?? "",
      department: r.department,
      position: r.position,
      employment_type: r.employment_type,
      join_date: r.join_date,
      base_salary: String(r.base_salary),
      ot_eligible: r.ot_eligible,
      status: r.status,
      resigned_on: r.resigned_on ?? "",
    })
    setError("")
    setOpen(true)
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.employee_code.trim() || !form.name.trim() || !form.join_date) {
      setError("Code, name and join date are required")
      return
    }
    setBusy(true)
    setError("")
    const payload = {
      employee_code: form.employee_code.trim(),
      name: form.name.trim(),
      nrc_no: form.nrc_no || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      department: form.department || "General",
      position: form.position || "Staff",
      employment_type: form.employment_type,
      join_date: form.join_date,
      base_salary: Number(form.base_salary) || 0,
      ot_eligible: form.ot_eligible,
      status: form.status,
      resigned_on: form.status === "resigned" ? form.resigned_on || null : null,
    }
    const original = editingId ? rows.find((r) => r.id === editingId) : null
    let createdId = editingId
    let res
    if (editingId) {
      res = await supabase.from("employees").update(payload).eq("id", editingId)
      if (!res.error && original) {
        if (original.status !== form.status) {
          await supabase.from("employee_events").insert({
            employee_id: editingId,
            event_type: "status_change",
            effective_date: form.status === "resigned" ? form.resigned_on || form.join_date : new Date().toISOString().slice(0, 10),
            title: form.status === "resigned" ? "Resigned" : "Re-activated",
            detail: null,
            amount: null,
          })
        }
        await logActivity(
          "employee",
          editingId,
          original.status !== form.status ? "status_change" : "updated",
          original.status !== form.status ? `${payload.name} marked ${form.status}` : `${payload.name} profile updated`
        )
      }
    } else {
      const ins = await supabase.from("employees").insert(payload).select().single()
      res = ins
      if (!ins.error && ins.data) {
        createdId = (ins.data as EmployeeRow).id
        await supabase.from("employee_events").insert({
          employee_id: createdId,
          event_type: "hired",
          effective_date: form.join_date,
          title: "Joined company",
          detail: `${payload.position}, ${payload.department}`,
          amount: payload.base_salary,
        })
        await seedLeaveBalances(createdId, Number(form.join_date.slice(0, 4)))
        await logActivity("employee", createdId, "created", `${payload.name} added as ${payload.position}`)
      }
    }
    setBusy(false)
    if (res.error) {
      setError(res.error.message)
      return
    }
    setOpen(false)
    await load()
  }

  const toggleStatus = async (r: EmployeeRow) => {
    const toResigned = r.status === "active"
    const res = await supabase
      .from("employees")
      .update({
        status: toResigned ? "resigned" : "active",
        resigned_on: toResigned ? new Date().toISOString().slice(0, 10) : null,
      })
      .eq("id", r.id)
    if (res.error) setError(res.error.message)
    else {
      await supabase.from("employee_events").insert({
        employee_id: r.id,
        event_type: "status_change",
        effective_date: new Date().toISOString().slice(0, 10),
        title: toResigned ? "Resigned" : "Re-activated",
        detail: null,
        amount: null,
      })
      await logActivity("employee", r.id, "status_change", `${r.name} ${toResigned ? "marked resigned" : "re-activated"}`)
      await load()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Employees</h1>
        <div className="flex gap-2">
          <Input
            placeholder="Search name, code, department…"
            className="w-56"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button onClick={openAdd}>+ Add employee</Button>
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>All employees</CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${filtered.length} record(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Basic salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.employee_code}</TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/employees/${r.id}`} className="hover:text-primary hover:underline">{r.name}</Link>
                  </TableCell>
                  <TableCell>{r.department}</TableCell>
                  <TableCell>{r.position}</TableCell>
                  <TableCell>{fmtDate(r.join_date)}</TableCell>
                  <TableCell className="text-right">{money(Number(r.base_salary))}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "active" ? "default" : "secondary"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button variant="outline" size="xs" nativeButton={false} render={<Link href={`/employees/${r.id}`} />}>
                      View
                    </Button>
                    <Button variant="outline" size="xs" onClick={() => openEdit(r)}>
                      Edit
                    </Button>
                    <Button variant="secondary" size="xs" onClick={() => toggleStatus(r)}>
                      {r.status === "active" ? "Mark resigned" : "Re-activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground text-center">
                    No employees found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88svh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit employee" : "Add employee"}</DialogTitle>
            <DialogDescription>Monthly basic salary is in MMK.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="emp-code">Employee code *</Label>
              <Input id="emp-code" value={form.employee_code} onChange={(e) => set("employee_code", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-name">Name *</Label>
              <Input id="emp-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-nrc">NRC No.</Label>
              <Input id="emp-nrc" value={form.nrc_no} onChange={(e) => set("nrc_no", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-phone">Phone</Label>
              <Input id="emp-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-email">Email</Label>
              <Input id="emp-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-address">Address</Label>
              <Input id="emp-address" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-dept">Department</Label>
              <Input id="emp-dept" value={form.department} onChange={(e) => set("department", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-pos">Position</Label>
              <Input id="emp-pos" value={form.position} onChange={(e) => set("position", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Employment type</Label>
              <Select value={form.employment_type} onValueChange={(v) => set("employment_type", String(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {{ full_time: "Full time", part_time: "Part time", contract: "Contract" }[form.employment_type] ??
                      form.employment_type}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full time</SelectItem>
                  <SelectItem value="part_time">Part time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-join">Join date *</Label>
              <Input id="emp-join" type="date" value={form.join_date} onChange={(e) => set("join_date", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-salary">Monthly basic salary (MMK)</Label>
              <Input id="emp-salary" type="number" min="0" value={form.base_salary} onChange={(e) => set("base_salary", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", String(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue>{form.status === "active" ? "Active" : "Resigned"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resigned">Resigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.status === "resigned" && (
              <div className="space-y-2">
                <Label htmlFor="emp-resigned">Resigned on</Label>
                <Input id="emp-resigned" type="date" value={form.resigned_on} onChange={(e) => set("resigned_on", e.target.value)} />
              </div>
            )}
            <label className="flex items-center gap-2 self-end pb-1 text-sm">
              <input
                type="checkbox"
                checked={form.ot_eligible}
                onChange={(e) => set("ot_eligible", e.target.checked)}
                className="size-4"
              />
              OT eligible
            </label>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
