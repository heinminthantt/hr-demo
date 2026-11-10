import { supabase } from "./supabase"

export async function logActivity(entity: string, entityId: string | null, action: string, detail?: string) {
  await supabase.from("activity_log").insert({
    entity,
    entity_id: entityId,
    action,
    detail: detail ?? null,
  })
}
