"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { CrudTable, type CrudOption, type CrudRow } from "@/components/crud-table"
import { PageHeader } from "@/components/page-header"
import { ChartCard, HorizontalBars } from "@/components/charts"
import { supabase } from "@/lib/supabase"
import { fmtDate, todayStr } from "@/lib/format"
import { pct } from "@/lib/hr"
import { seedLeaveBalances } from "@/lib/leave"
import { logActivity } from "@/lib/activity"

type Job = { id: string; title: string; status: string; department: string; employment_type: string }
type Applicant = {
  id: string
  name: string
  stage: string
  applied_on: string
  job_id: string | null
  email: string | null
  phone: string | null
  employee_id: string | null
}
type EmployeeCode = { id: string; employee_code: string }

const STAGE_ORDER = ["applied", "screening", "interview", "offer", "hired"]

const EMPLOYMENT_TYPES: CrudOption[] = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" },
]

const JOB_STATUSES: CrudOption[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
]

const STAGES: CrudOption[] = [
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
]

export default function RecruitmentPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [employees, setEmployees] = useState<EmployeeCode[]>([])
  const [hireRow, setHireRow] = useState<CrudRow | null>(null)
  const hireReload = useRef<null | (() => Promise<void>)>(null)
  const [hireForm, setHireForm] = useState({ employee_code: "", join_date: todayStr(), base_salary: "", ot_eligible: true })
  const [hireError, setHireError] = useState("")
  const [hiring, setHiring] = useState(false)

  const loadJobs = useCallback(async () => {
    const [{ data: jobRows }, { data: applicantRows }, { data: empRows }] = await Promise.all([
      supabase.from("job_posts").select("id, title, status, department, employment_type").order("created_at", { ascending: false }),
      supabase.from("applicants").select("id, name, stage, applied_on, job_id, email, phone, employee_id"),
      supabase.from("employees").select("id, employee_code"),
    ])
    setJobs((jobRows as Job[]) ?? [])
    setApplicants((applicantRows as Applicant[]) ?? [])
    setEmployees((empRows as EmployeeCode[]) ?? [])
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const byId = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs])
  const jobOptions = jobs.map((j) => ({ value: j.id, label: j.title }))
  const jobTitle = (id: string | null) => (id ? (byId.get(id)?.title ?? "(deleted)") : "No job")

  const nextCode = useMemo(() => {
    const max = employees.reduce((m, e) => Math.max(m, Number(e.employee_code.replace(/\D/g, "")) || 0), 0)
    return `EMP-${String(max + 1).padStart(3, "0")}`
  }, [employees])

  const openHire = (row: CrudRow, reload: () => Promise<void>) => {
    hireReload.current = reload
    setHireRow(row)
    setHireForm({ employee_code: nextCode, join_date: todayStr(), base_salary: "", ot_eligible: true })
    setHireError("")
  }

  const confirmHire = async () => {
    if (!hireRow) return
    const salary = Number(hireForm.base_salary)
    if (!hireForm.employee_code.trim() || !hireForm.join_date || !Number.isFinite(salary) || salary <= 0) {
      setHireError("Employee code, join date and a basic salary above zero are required")
      return
    }
    setHiring(true)
    setHireError("")
    const job = hireRow.job_id ? byId.get(String(hireRow.job_id)) : undefined
    const payload = {
      employee_code: hireForm.employee_code.trim(),
      name: String(hireRow.name),
      email: hireRow.email ? String(hireRow.email) : null,
      phone: hireRow.phone ? String(hireRow.phone) : null,
      department: job?.department ?? "General",
      position: job?.title ?? "Staff",
      employment_type: job?.employment_type ?? "full_time",
      join_date: hireForm.join_date,
      base_salary: salary,
      ot_eligible: hireForm.ot_eligible,
      status: "active",
      resigned_on: null,
    }
    const ins = await supabase.from("employees").insert(payload).select().single()
    if (ins.error || !ins.data) {
      setHiring(false)
      setHireError(ins.error?.message ?? "Could not create the employee record")
      return
    }
    const employeeId = (ins.data as { id: string }).id
    await supabase.from("employee_events").insert({
      employee_id: employeeId,
      event_type: "hired",
      effective_date: hireForm.join_date,
      title: "Joined company",
      detail: `${payload.position}, ${payload.department}`,
      amount: salary,
    })
    await seedLeaveBalances(employeeId, Number(hireForm.join_date.slice(0, 4)))
    await supabase.from("applicants").update({ stage: "hired", employee_id: employeeId }).eq("id", hireRow.id)
    if (job?.status === "open") {
      await supabase.from("job_posts").update({ status: "closed" }).eq("id", job.id)
    }
    await logActivity("employee", employeeId, "hired", `${payload.name} hired as ${payload.position}`)
    await logActivity("applicant", String(hireRow.id), "hired", `${payload.name} hired for ${payload.position}`)
    setHiring(false)
    setHireRow(null)
    await hireReload.current?.()
    await loadJobs()
  }

  const openRoles = jobs.filter((j) => j.status === "open")
  const hired = applicants.filter((a) => a.stage === "hired").length
  const rejected = applicants.filter((a) => a.stage === "rejected").length
  const activePipeline = applicants.filter((a) => !["hired", "rejected"].includes(a.stage)).length

  const funnel = STAGE_ORDER.map((stage, i) => {
    const rank = STAGE_ORDER.indexOf(stage)
    const value = applicants.filter((a) => {
      const rowRank = STAGE_ORDER.indexOf(a.stage)
      return rowRank === -1 ? i === 0 : rowRank >= rank
    }).length
    return { label: stage, value, hint: `${value} · ${pct(value, Math.max(1, applicants.length))}%` }
  })

  const roleDepartments = useMemo(() => {
    const map = new Map<string, number>()
    for (const job of openRoles) map.set(job.department, (map.get(job.department) ?? 0) + 1)
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, hint: `${value} open role(s)` }))
  }, [openRoles])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recruitment"
        description="Open roles, applicant pipeline and hiring outcomes."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open roles" value={String(openRoles.length)} hint={`${jobs.length} job post(s) total`} />
        <Stat label="Active pipeline" value={String(activePipeline)} hint={`${applicants.length} applicant(s) total`} />
        <Stat label="Hired" value={String(hired)} hint={`${pct(hired, Math.max(1, applicants.length))}% of applicants`} />
        <Stat label="Rejected" value={String(rejected)} hint={`${pct(rejected, Math.max(1, applicants.length))}% of applicants`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Recruitment funnel" description="Applicants reaching each stage or beyond.">
          <HorizontalBars data={funnel} formatValue={(n) => `${n} applicant(s)`} />
        </ChartCard>
        <ChartCard title="Open roles by department" description="Where hiring demand sits right now.">
          {roleDepartments.length > 0 ? (
            <HorizontalBars data={roleDepartments} formatValue={(n) => `${n} role(s)`} />
          ) : (
            <p className="text-muted-foreground py-10 text-center text-sm">No open roles.</p>
          )}
        </ChartCard>
      </div>

      <CrudTable
        title="Job posts"
        table="job_posts"
        addLabel="+ New job"
        onChanged={loadJobs}
        onSaved={async (next, previous) => {
          if (!previous) {
            await logActivity("job_post", String(next.id), "created", `${next.title} opened in ${next.department}`)
          } else if (previous.status !== next.status) {
            await logActivity("job_post", String(next.id), String(next.status), `${next.title} ${next.status}`)
          }
        }}
        fields={[
          { key: "title", label: "Role title", required: true },
          { key: "department", label: "Department", defaultValue: "General" },
          { key: "employment_type", label: "Employment type", type: "select", optionsKey: "employment", defaultValue: "full_time" },
          { key: "status", label: "Status", type: "select", optionsKey: "jobStatus", defaultValue: "open" },
          { key: "description", label: "Description", type: "textarea" },
        ]}
        options={{ employment: EMPLOYMENT_TYPES, jobStatus: JOB_STATUSES }}
        searchKeys={["title", "department"]}
        columns={[
          { key: "title", label: "Role" },
          { key: "department", label: "Department" },
          {
            key: "employment_type",
            label: "Type",
            render: (r) => EMPLOYMENT_TYPES.find((t) => t.value === r.employment_type)?.label ?? r.employment_type,
          },
          {
            key: "status",
            label: "Status",
            render: (r) => <Badge variant={r.status === "open" ? "default" : "secondary"}>{r.status}</Badge>,
          },
        ]}
      />

      <CrudTable
        title="Applicants"
        table="applicants"
        addLabel="+ New applicant"
        onChanged={loadJobs}
        beforeSave={(payload, previous) =>
          payload.stage === "hired" && previous?.stage !== "hired"
            ? "Use the Hire button to create the employee record for a hired applicant."
            : null
        }
        onSaved={async (next, previous) => {
          if (!previous) {
            await logActivity("applicant", String(next.id), "created", `${next.name} added to the pipeline`)
          } else if (previous.stage !== next.stage) {
            await logActivity("applicant", String(next.id), String(next.stage), `${next.name} moved to ${next.stage}`)
          }
        }}
        fields={[
          { key: "name", label: "Name", required: true },
          { key: "job_id", label: "Job", type: "select", optionsKey: "job" },
          { key: "email", label: "Email", type: "text" },
          { key: "phone", label: "Phone", type: "text" },
          { key: "stage", label: "Stage", type: "select", optionsKey: "stage", defaultValue: "applied" },
          { key: "applied_on", label: "Applied on", type: "date", required: true, defaultValue: todayStr() },
          { key: "notes", label: "Notes", type: "textarea" },
        ]}
        options={{ job: jobOptions, stage: STAGES }}
        searchKeys={["name", "email", "phone", "notes"]}
        columns={[
          { key: "name", label: "Name" },
          { key: "job_id", label: "Job", render: (r) => jobTitle(r.job_id) },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "applied_on", label: "Applied", render: (r) => fmtDate(r.applied_on) },
          {
            key: "stage",
            label: "Stage",
            render: (r) => (
              <Badge variant={r.stage === "hired" ? "default" : r.stage === "rejected" ? "secondary" : "outline"}>
                {r.stage}
              </Badge>
            ),
          },
        ]}
        rowActions={(row, reload) =>
          row.employee_id ? (
            <Button variant="outline" size="xs" nativeButton={false} render={<Link href={`/employees/${row.employee_id}`} />}>
              Open employee
            </Button>
          ) : row.stage === "rejected" ? null : (
            <Button variant="secondary" size="xs" onClick={() => openHire(row, reload)}>
              Hire
            </Button>
          )
        }
      />

      <Dialog open={Boolean(hireRow)} onOpenChange={(open) => { if (!open && !hiring) setHireRow(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Hire applicant</DialogTitle>
            <DialogDescription>
              {hireRow ? `${hireRow.name} · ${jobTitle(hireRow.job_id)}` : "Creates the employee record, hired event and leave balances."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hire-code">Employee code *</Label>
              <Input
                id="hire-code"
                value={hireForm.employee_code}
                onChange={(e) => setHireForm({ ...hireForm, employee_code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hire-join">Join date *</Label>
              <Input
                id="hire-join"
                type="date"
                value={hireForm.join_date}
                onChange={(e) => setHireForm({ ...hireForm, join_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hire-salary">Monthly basic salary (MMK) *</Label>
              <Input
                id="hire-salary"
                type="number"
                min="0"
                value={hireForm.base_salary}
                onChange={(e) => setHireForm({ ...hireForm, base_salary: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                checked={hireForm.ot_eligible}
                onChange={(e) => setHireForm({ ...hireForm, ot_eligible: e.target.checked })}
                className="size-4"
              />
              OT eligible
            </label>
          </div>
          {hireError && <p className="text-destructive text-sm">{hireError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHireRow(null)} disabled={hiring}>
              Cancel
            </Button>
            <Button onClick={confirmHire} disabled={hiring}>
              {hiring ? "Hiring..." : "Create employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
