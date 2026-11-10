import { createClient } from "@supabase/supabase-js"
import { createLocalClient } from "./local-db"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

// False -> the app runs on the seeded browser demo store (lib/local-db.ts).
export const supabaseConfigured = Boolean(url && key)

export const supabase = supabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : (createLocalClient() as unknown as ReturnType<typeof createClient>)
