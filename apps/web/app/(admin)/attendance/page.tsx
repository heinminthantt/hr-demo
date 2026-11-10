"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
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
import type { EmployeeRow } from "@/lib/payroll"
import { todayStr, isoAt, timeOf } from "@/lib/format"

type Status = "present" | "half_day" | "absent" | "leave" | "holiday"

type Row = {
  status: Status
  check_in: string // "HH:MM" or ""
  check_out: string
  ot_hours: string // numeric input as string
}

const STATUSES: Status[] = ["present", "half_day", "absent", "leave", "holiday"]

export default function AttendancePage() {
  const [date, setDate] = useState(todayStr())
  const [emps, setEmps] = useState<EmployeeRow[]>([])
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [savedAt, setSavedAt] = useState("")

  const load = useCallback(async (d: string) => {
    setLoading(true)
    setError("")
    const [{ data: empData, error: e1 }, { data: attData, error: e2 }] = await Promise.all([
      supabase
        .from("employees")
        .select("*")
        .eq("status", "active")
        .lte("join_date", d)
        .order("employee_code"),
      supabase.from("attendance").select("employee_id, status, check_in, check_out, ot_hours").eq("work_date", d),
    ])
    if (e1 || e2) setError((e1?.message ?? "") + (e2?.message ?? ""))
    const list = (empData as EmployeeRow[]) ?? []
    setEmps(list)
    const next: Record<string, Row> = {}
    for (const e of list) {
      next[e.id] = { status: "absent", check_in: "", check_out: "", ot_hours: "0" }
    }
    for (const a of (attData as { employee_id: string; status: string; check_in: string | null; check_out: string | null; ot_hours: number | null }[] | null) ?? []) {
      const slot = next[a.employee_id]
      if (slot) {
        next[a.employee_id] = {
          ...slot,
          status: (a.status as Status) ?? "absent",
          check_in: timeOf(a.check_in),
          check_out: timeOf(a.check_out),
          ot_hours: String(a.ot_hours ?? 0),
        }
      }
    }
    setRows(next)
    setLoading(false)
  }, [])

  useEffect(() => {
    load(date).catch(() => setLoading(false))
  }, [date, load])

  const set = (empId: string, patch: Partial<Row>) =>
    setRows((r) => {
      const base = r[empId]
      if (!base) return r
      return { ...r, [empId]: { ...base, ...patch } }
    })

  const markAllPresent = () =>
    setRows((r) => {
      const next = { ...r }
      for (const k of Object.keys(next)) {
        const cur = next[k]
        if (cur && !cur.check_in) next[k] = { ...cur, status: "present" as Status }
      }
      return next
    })

  const dirty = useMemo(() => emps.length > 0 && savedAt !== date, [emps, savedAt])

  const save = async () => {
    setBusy(true)
    setError("")
    const list = emps.map((e) => {
      const r = rows[e.id]
      if (!r) throw new Error("row missing - loaded together with employees")
      return {
        employee_id: e.id,
        work_date: date,
        status: r.status,
        // times stored as wall-clock "HH:MM" -> timestamptz "HH:MM:00Z" (see lib/format.ts)
        check_in: r.check_in ? isoAt(date, r.check_in) : null,
        check_out: r.check_out ? isoAt(date, r.check_out) : null,
        ot_hours: Number(r.ot_hours) || 0,
      }
    })
    const res = list.length
      ? await supabase.from("attendance").upsert(list, { onConflict: "employee_id,work_date" })
      : { error: null as null }
    setBusy(false)
    if (res.error) {
      setError(res.error.message)
      return
    }
    setSavedAt(date)
  }

  const paid = emps.filter((e) => {
    const r = rows[e.id]
    return r && (r.status === "present" || r.status === "half_day" || r.status === "leave" || r.status === "holiday")
  }).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Attendance</h1>
          <p className="text-muted-foreground text-sm">
            {loading ? "Loading…" : `${paid} paid / ${emps.length} active`}
            {savedAt && !dirty && !loading && <span className="ml-2 text-xs">· saved ✓</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            type="date"
            className="w-40"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Button variant="outline" onClick={markAllPresent} disabled={loading}>
            Mark all present
          </Button>
          <Button onClick={save} disabled={loading || busy || emps.length === 0}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Daily register - {date}</CardTitle>
          <CardDescription>present/leave/holiday = 1 day · half-day = 0.5 · absent = 0 (used by Payroll)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="w-40">Status</TableHead>
                <TableHead className="w-28">Check in</TableHead>
                <TableHead className="w-28">Check out</TableHead>
                <TableHead className="w-24">OT hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emps.map((e) => {
                const r = rows[e.id]
                const onDuty = r && (r.status === "present" || r.status === "half_day")
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link href={`/attendance/${e.id}`} className="text-sm font-medium hover:text-primary hover:underline">{e.name}</Link>
                      <p className="text-muted-foreground font-mono text-xs">{e.employee_code}</p>
                    </TableCell>
                    <TableCell>
                      <Select value={r?.status} onValueChange={(v) => set(e.id, { status: String(v) as Status })}>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {r?.status ? (r.status === "half_day" ? "half-day" : r.status) : "Status"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s === "half_day" ? "half-day" : s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                       
                        disabled={!onDuty}
                        value={r?.check_in ?? ""}
                        onChange={(ev) => set(e.id, { check_in: ev.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                       
                        disabled={!onDuty}
                        value={r?.check_out ?? ""}
                        onChange={(ev) => set(e.id, { check_out: ev.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                       
                        disabled={!onDuty}
                        value={r?.ot_hours ?? "0"}
                        onChange={(ev) => set(e.id, { ot_hours: ev.target.value })}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
              {!loading && emps.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center">
                    No active employees (joined on or before this date).
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
