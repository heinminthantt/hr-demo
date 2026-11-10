"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
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
import { fmtDate } from "@/lib/format"

export type CrudRow = Record<string, any>

export type CrudOption = { value: string; label: string }

export type CrudField = {
  key: string
  label: string
  type?: "text" | "number" | "date" | "select" | "textarea" | "checkbox"
  optionsKey?: string
  required?: boolean
  defaultValue?: string | number | boolean
  placeholder?: string
}

export type CrudColumn = {
  key: string
  label: string
  align?: "left" | "right"
  render?: (row: CrudRow) => ReactNode
}

type Props = {
  title: string
  description?: string
  table: string
  columns: CrudColumn[]
  fields: CrudField[]
  options?: Record<string, CrudOption[]>
  orderBy?: string
  ascending?: boolean
  searchKeys?: string[]
  addLabel?: string
  emptyText?: string
  canEdit?: boolean
  canDelete?: boolean
  onChanged?: () => void
  onSaved?: (row: CrudRow, previous: CrudRow | null) => void | Promise<void>
  beforeSave?: (payload: CrudRow, previous: CrudRow | null) => string | null
  rowActions?: (row: CrudRow, reload: () => Promise<void>) => ReactNode
}

const blankFor = (fields: CrudField[]): CrudRow =>
  Object.fromEntries(
    fields.map((f) => [
      f.key,
      f.defaultValue ?? (f.type === "checkbox" ? false : f.type === "number" ? "0" : ""),
    ])
  )

export function CrudTable({
  title,
  description,
  table,
  columns,
  fields,
  options = {},
  orderBy = "created_at",
  ascending = false,
  searchKeys,
  addLabel = "+ Add",
  emptyText = "No records yet.",
  canEdit = true,
  canDelete = true,
  onChanged,
  onSaved,
  beforeSave,
  rowActions,
}: Props) {
  const [rows, setRows] = useState<CrudRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CrudRow>(() => blankFor(fields))
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase.from(table).select("*").order(orderBy, { ascending })
    if (err) setError(err.message)
    setRows((data as CrudRow[]) ?? [])
    setLoading(false)
  }, [table, orderBy, ascending])

  useEffect(() => {
    reload().catch(() => setLoading(false))
  }, [reload])

  const filtered = useMemo(() => {
    if (!searchKeys?.length) return rows
    const q = search.toLowerCase()
    return rows.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q)))
  }, [rows, search, searchKeys])

  const openAdd = () => {
    setEditingId(null)
    setForm(blankFor(fields))
    setError("")
    setOpen(true)
  }

  const openEdit = (row: CrudRow) => {
    setEditingId(row.id)
    setForm(
      Object.fromEntries(
        fields.map((f) => {
          const v = row[f.key]
          return [f.key, f.type === "checkbox" ? Boolean(v) : v === null || v === undefined ? "" : String(v)]
        })
      )
    )
    setError("")
    setOpen(true)
  }

  const set = (key: string, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    const missing = fields.filter((f) => f.required && String(form[f.key] ?? "").trim() === "")
    if (missing.length) {
      setError(`Required: ${missing.map((f) => f.label).join(", ")}`)
      return
    }
    const payload: CrudRow = {}
    for (const f of fields) {
      const v = form[f.key]
      if (f.type === "number") payload[f.key] = Number(v) || 0
      else if (f.type === "checkbox") payload[f.key] = Boolean(v)
      else if (f.type === "date") payload[f.key] = v || null
      else payload[f.key] = typeof v === "string" ? v.trim() || null : v
    }
    const previous = editingId ? (rows.find((r) => r.id === editingId) ?? null) : null
    const blocked = beforeSave?.(payload, previous)
    if (blocked) {
      setError(blocked)
      return
    }
    setBusy(true)
    setError("")
    const query = editingId
      ? supabase.from(table).update(payload).eq("id", editingId)
      : supabase.from(table).insert(payload)
    const res = await query.select().single()
    setBusy(false)
    if (res.error) {
      setError(res.error.message)
      return
    }
    const saved = (res.data as CrudRow | null) ?? { ...payload, id: editingId ?? "" }
    await onSaved?.(saved, previous)
    setOpen(false)
    await reload()
    onChanged?.()
  }

  const remove = async (row: CrudRow) => {
    if (!window.confirm(`Delete this ${title.toLowerCase().replace(/s$/, "")}?`)) return
    const res = await supabase.from(table).delete().eq("id", row.id)
    if (res.error) {
      setError(res.error.message)
      return
    }
    await reload()
    onChanged?.()
  }

  const showActions = canEdit || canDelete || Boolean(rowActions)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{loading ? "Loading…" : description ?? `${filtered.length} record(s)`}</CardDescription>
          </div>
          <div className="flex gap-2">
            {searchKeys?.length ? (
              <Input
                placeholder="Search…"
                className="w-40"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            ) : null}
            <Button onClick={openAdd}>{addLabel}</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="text-destructive mb-3 text-sm">{error}</p>}
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.align === "right" ? "text-right" : undefined}>
                  {c.label}
                </TableHead>
              ))}
              {showActions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.id}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={c.align === "right" ? "text-right" : undefined}>
                    {c.render ? c.render(row) : formatCell(row[c.key])}
                  </TableCell>
                ))}
                {showActions && (
                  <TableCell className="space-x-2 text-right">
                    {rowActions?.(row, reload)}
                    {canEdit && (
                      <Button variant="outline" size="xs" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="xs" onClick={() => remove(row)}>
                        Delete
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + (showActions ? 1 : 0)} className="text-muted-foreground text-center">
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88svh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? `Edit ${title.toLowerCase()}` : addLabel.replace(/^\+ /, "")}</DialogTitle>
            <DialogDescription>Changes save straight to the current data store.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className={f.type === "textarea" ? "space-y-2 sm:col-span-2" : "space-y-2"}>
                <Label htmlFor={`field-${f.key}`}>
                  {f.label}
                  {f.required ? " *" : ""}
                </Label>
                {f.type === "select" ? (
                  <Select value={String(form[f.key] ?? "")} onValueChange={(v) => set(f.key, String(v))}>
                    <SelectTrigger id={`field-${f.key}`} className="w-full">
                      <SelectValue placeholder={f.placeholder ?? "Select"}>
                        {(value: unknown) =>
                          (options[f.optionsKey ?? f.key] ?? []).find((o) => o.value === value)?.label ??
                          f.placeholder ??
                          "Select"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(options[f.optionsKey ?? f.key] ?? []).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : f.type === "textarea" ? (
                  <Textarea
                    id={`field-${f.key}`}
                    placeholder={f.placeholder}
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                ) : f.type === "checkbox" ? (
                  <input
                    id={`field-${f.key}`}
                    type="checkbox"
                    checked={Boolean(form[f.key])}
                    onChange={(e) => set(f.key, e.target.checked)}
                    className="size-4"
                  />
                ) : (
                  <Input
                    id={`field-${f.key}`}
                    type={f.type ?? "text"}
                    placeholder={f.placeholder}
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
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
    </Card>
  )
}

function formatCell(v: unknown): ReactNode {
  if (v === null || v === undefined || v === "") return "-"
  if (typeof v === "number") return new Intl.NumberFormat("en-US").format(v)
  if (typeof v === "boolean") return v ? "Yes" : "No"
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return fmtDate(s.slice(0, 10))
  return s
}
