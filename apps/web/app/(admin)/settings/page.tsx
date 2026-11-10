"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { RiCloseLine } from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { supabase, supabaseConfigured } from "@/lib/supabase"
import { resetLocalDb } from "@/lib/local-db"
import { type PitBracket } from "@/lib/payroll"
import { useAppearance } from "@/components/appearance-provider"
import type { Appearance } from "@/lib/appearance"

type BracketRow = { up_to: string; rate: string } // up_to "" = open (no ceiling)

const cur = (n: unknown) => String(Number(n ?? 0))

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { appearance, setAppearance, resetAppearance } = useAppearance()
  const [currency, setCurrency] = useState("MMK")
  const [ssbEmployee, setSsbEmployee] = useState("2")
  const [ssbEmployer, setSsbEmployer] = useState("3")
  const [ssbMin, setSsbMin] = useState("40000")
  const [ssbMax, setSsbMax] = useState("300000")
  const [relief, setRelief] = useState("20")
  const [brackets, setBrackets] = useState<BracketRow[]>([])
  const [otMultiplier, setOtMultiplier] = useState("1.5")
  const [stdDays, setStdDays] = useState("26")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [savedOn, setSavedOn] = useState("")

  useEffect(() => {
    ;(async () => {
      const { data, error: err } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()
      if (err) setError(err.message)
      if (data) {
        const s = data as Record<string, unknown>
        setCurrency(String(s.currency ?? "MMK"))
        setSsbEmployee(cur(s.ssb_employee_pct))
        setSsbEmployer(cur(s.ssb_employer_pct))
        setSsbMin(cur(s.ssb_base_min))
        setSsbMax(cur(s.ssb_base_max))
        setRelief(cur(s.pit_relief_pct))
        setOtMultiplier(cur(s.ot_multiplier))
        setStdDays(cur(s.standard_work_days))
        setBrackets(
          (((s.pit_brackets as PitBracket[] | null) ?? []) as PitBracket[]).map((b) => ({
            up_to: b.up_to === null ? "" : String(b.up_to),
            rate: String(b.rate),
          }))
        )
      }
      setLoading(false)
    })().catch(() => setLoading(false))
  }, [])

  const setBracket = (i: number, patch: Partial<BracketRow>) =>
    setBrackets((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)))

  const save = async () => {
    setError("")
    // normalize: "" -> null, numbers, sorted ascending, single open bracket at the end
    let nullCount = 0
    const parsed: PitBracket[] = brackets.map((b) => {
      const upTo = b.up_to.trim() === "" ? null : Number(b.up_to)
      if (upTo === null) nullCount++
      return { up_to: Number.isFinite(upTo) ? upTo : null, rate: Number(b.rate) || 0 }
    })
    if (nullCount > 1) {
      setError("Only the LAST bracket may be open (empty ceiling) - make it one row.")
      return
    }
    if (nullCount === 0) {
      setError("One bracket must have an empty ceiling (the open-ended top rate).")
      return
    }
    const sorted = [...parsed].sort((a, b) => (a.up_to ?? Infinity) - (b.up_to ?? Infinity))
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const next = sorted[i]
      if (!prev || !next) continue
      if (
        prev.up_to !== null &&
        next.up_to !== null &&
        prev.up_to >= next.up_to
      ) {
        setError(`Brackets must ascend without duplicates - value at row ${i + 1} (${next.up_to}) is not above row ${i} (${prev.up_to}).`)
        return
      }
    }
    setBusy(true)
    const res = await supabase
      .from("app_settings")
      .update({
        currency: currency.trim() || "MMK",
        ssb_employee_pct: Number(ssbEmployee) || 0,
        ssb_employer_pct: Number(ssbEmployer) || 0,
        ssb_base_min: Number(ssbMin) || 0,
        ssb_base_max: Number(ssbMax) || 0,
        pit_relief_pct: Number(relief) || 0,
        pit_brackets: sorted,
        ot_multiplier: Number(otMultiplier) || 1,
        standard_work_days: Number(stdDays) || 26,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
    setBusy(false)
    if (res.error) {
      setError(res.error.message)
      return
    }
    setBrackets(sorted.map((b) => ({ up_to: b.up_to === null ? "" : String(b.up_to), rate: String(b.rate) })))
    setSavedOn(new Date().toLocaleTimeString())
  }

  const numField = (label: string, id: string, val: string, onChange: (v: string) => void, hint?: string, min = "0") => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" min={min} value={val} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )

  if (loading) return <p className="text-muted-foreground p-6 text-sm">Loading settings…</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Settings</h1>
          <p className="text-muted-foreground text-sm">
            {savedOn ? `Saved ✓ ${savedOn}` : "Appearance applies instantly · payroll rules apply to new drafts."}
          </p>
        </div>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Personal display preferences. Saved in this browser and applied before the first paint.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={resetAppearance}>Reset appearance</Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1.5">
            <Label>Theme</Label>
            <Select value={theme ?? "system"} onValueChange={(v) => setTheme(String(v))}>
              <SelectTrigger className="w-full"><SelectValue>{theme ?? "system"}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Font size</Label>
            <Select value={appearance.fontSize} onValueChange={(v) => setAppearance({ fontSize: String(v) as Appearance["fontSize"] })}>
              <SelectTrigger className="w-full"><SelectValue>{appearance.fontSize === "sm" ? "Small" : appearance.fontSize === "lg" ? "Large" : "Default"}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Small</SelectItem>
                <SelectItem value="md">Default</SelectItem>
                <SelectItem value="lg">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>UI scale</Label>
            <Select value={String(appearance.zoom)} onValueChange={(v) => setAppearance({ zoom: Number(v) as Appearance["zoom"] })}>
              <SelectTrigger className="w-full"><SelectValue>{appearance.zoom}%</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="90">90%</SelectItem>
                <SelectItem value="100">100%</SelectItem>
                <SelectItem value="110">110%</SelectItem>
                <SelectItem value="125">125%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Density</Label>
            <Select value={appearance.density} onValueChange={(v) => setAppearance({ density: String(v) as Appearance["density"] })}>
              <SelectTrigger className="w-full"><SelectValue>{appearance.density === "compact" ? "Compact" : "Comfortable"}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">Comfortable</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Corner radius</Label>
            <Select value={appearance.radius} onValueChange={(v) => setAppearance({ radius: String(v) as Appearance["radius"] })}>
              <SelectTrigger className="w-full"><SelectValue>{appearance.radius === "sharp" ? "Sharp" : appearance.radius === "rounded" ? "Rounded" : "Default"}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="sharp">Sharp</SelectItem>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="rounded">Rounded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>General & SSB</CardTitle>
            <CardDescription>
              SSB contributes on the clamped basis: min(base_salary, ssb_base_max), floored at ssb_base_min.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cur">Currency</Label>
              <Input id="cur" value={currency} onChange={(e) => setCurrency(e.target.value)} />
              <p className="text-muted-foreground text-xs">e.g. MMK</p>
            </div>
            <div />
            {numField("SSB employee %", "ssb-e", ssbEmployee, setSsbEmployee, "Default 2%")}
            {numField("SSB employer %", "ssb-r", ssbEmployer, setSsbEmployer, "Default 3% - not deducted from salary")}
            {numField("SSB basis min (MMK)", "ssb-min", ssbMin, setSsbMin)}
            {numField("SSB basis max (MMK)", "ssb-max", ssbMax, setSsbMax)}
            {numField("OT multiplier (×)", "ot", otMultiplier, setOtMultiplier, "1.5 = hourly rate × 1.5", "0.1")}
            {numField("Standard work days / month", "days", stdDays, setStdDays, "Basic = salary × days worked ÷ this")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PIT - progressive brackets</CardTitle>
            <CardDescription>
              Monthly taxable salary after {Number(relief) || 0}% earned income relief. Empty ceiling = open top rate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {numField("Earned income relief %", "relief", relief, setRelief, "Default 20% of gross")}
            <div className="space-y-2">
              <div className="text-muted-foreground grid grid-cols-[1fr_1fr_auto] gap-2 text-xs">
                <span>Ceiling (taxable ≤)</span>
                <span>Rate %</span>
                <span />
              </div>
              {brackets.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    placeholder="open top rate"
                    value={b.up_to}
                    onChange={(e) => setBracket(i, { up_to: e.target.value })}
                  />
                  <Input type="number" min="0" max="95" value={b.rate} onChange={(e) => setBracket(i, { rate: e.target.value })} />
                  <Button variant="ghost" size="icon" onClick={() => setBrackets((bs) => bs.filter((_, j) => j !== i))} aria-label="Remove bracket">
                    <RiCloseLine />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setBrackets((bs) => [...bs, { up_to: "", rate: "5" }])}>
                + Add bracket
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {!supabaseConfigured && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Local demo data</CardTitle>
            <CardDescription>
              Supabase is not connected, so the app runs on seeded data stored in this browser. Reset it to start
              over with fresh sample records.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => {
                resetLocalDb()
                window.location.reload()
              }}
            >
              Reset demo data
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
