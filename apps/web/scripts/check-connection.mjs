// Connection check: `npm run check:connection` (reads .env.local via --env-file)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env.local")
  process.exit(1)
}

const fail = (msg) => {
  console.error("FAIL:" + msg)
  process.exit(1)
}

for (const host of [new URL(url).host, "supabase.co"]) {
  try {
    await fetch(`https://${host}`, { method: "HEAD" })
    console.log(`ok   reachable: ${host}`)
  } catch {
    fail(`cannot reach ${host} - check your network/VPN`)
  }
}

const rest = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
}).catch((e) => fail(e.message))
console.log(`Data API:  HTTP ${rest.status}`)
if (!rest.ok) fail("key rejected or API disabled")

const settings = await fetch(`${url}/rest/v1/app_settings?select=currency,ssb_employee_pct`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
}).catch((e) => fail(e.message))
const body = await settings.text()
if (settings.status === 200 && body.includes("currency")) {
  console.log(`ok   schema live: app_settings row readable${body}`)
  console.log("\nConnection fully working - run `npm run dev` (repo root) and sign in.")
} else {
  console.log(`ok   key works, but schema not applied yet (HTTP ${settings.status})`)
  console.log("     Paste supabase/migrations/0001_init.sql in the SQL editor, then re-run.")
}
