// Self-check for the offline demo store: `npm run check:localdb` in apps/web
import { LOCAL_DB_KEY, createLocalClient } from "../lib/local-db.ts"

let failed = 0
function eq(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failed++
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  } else {
    console.log(`ok   ${label}`)
  }
}

const data = new Map<string, string>()
const storage = {
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => void data.set(k, v),
  removeItem: (k: string) => void data.delete(k),
}

const db = createLocalClient(storage) as any

const employees = await db.from("employees").select("*").order("employee_code")
eq(employees.data.length, 20, "seeds twenty employees")
eq(employees.data[0].employee_code, "EMP-001", "orders by employee code")

const activeCount = await db.from("employees").select("*", { count: "exact", head: true }).eq("status", "active")
eq(activeCount.data, null, "head query returns no rows")
eq(activeCount.count, 18, "head query returns count")

const settings = await db.from("app_settings").select("*").eq("id", 1).maybeSingle()
eq(settings.data.ssb_employee_pct, 2, "settings row is seeded")
eq(settings.data.pit_brackets.length, 6, "PIT brackets are arrays, not JSON text")

const run = await db.from("payroll_runs").select("*, payslips(net_pay)").limit(1).maybeSingle()
eq(run.data.payslips.length > 0, true, "embedded payslips attach to a run")
eq(typeof run.data.payslips[0].net_pay, "number", "embedded payslip keeps net_pay")

const inserted = await db.from("leave_requests").insert({ employee_id: "emp-1", leave_type: "annual", start_date: "2026-11-10", end_date: "2026-11-10", days: 1, status: "pending" })
eq(inserted.data.length, 1, "insert returns the new row")
eq(typeof inserted.data[0].id, "string", "insert assigns an id")

const updated = await db.from("leave_requests").update({ status: "approved" }).eq("id", inserted.data[0].id)
eq(updated.data[0].status, "approved", "update merges the patch")

const sample = await db.from("attendance").select("*").limit(1).maybeSingle()
const key = { employee_id: sample.data.employee_id, work_date: sample.data.work_date }
const before = await db.from("attendance").select("*", { count: "exact", head: true }).eq("employee_id", key.employee_id).eq("work_date", key.work_date)
await db.from("attendance").upsert([{ ...key, status: "leave", ot_hours: 0 }], { onConflict: "employee_id,work_date" })
const after = await db.from("attendance").select("*", { count: "exact", head: true }).eq("employee_id", key.employee_id).eq("work_date", key.work_date)
const row = await db.from("attendance").select("*").eq("employee_id", key.employee_id).eq("work_date", key.work_date).maybeSingle()
eq(after.count, before.count, "upsert does not duplicate on conflict keys")
eq(row.data.status, "leave", "upsert applies the patch")

const draft = await db.from("payroll_runs").insert({ period_month: 12, period_year: 2026 }).select().single()
eq(draft.data.status, "draft", "insert applies schema defaults")
eq(draft.data.finalized_at, null, "insert applies null defaults")

const removed = await db.from("tasks").delete().eq("id", "task-1")
eq(removed.data.length, 1, "delete returns the removed row")
const tasks = await db.from("tasks").select("*")
eq(tasks.data.length, 9, "delete removes the row")

storage.removeItem(LOCAL_DB_KEY)
const reseeded = await db.from("employees").select("id")
eq(reseeded.data.length, 20, "reset reseeds the store")

if (failed) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log("\nall local-db checks passed")
