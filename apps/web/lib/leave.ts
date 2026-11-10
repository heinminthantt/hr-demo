import { supabase } from "./supabase"
import { DEFAULT_LEAVE_ENTITLEMENTS } from "./hr"

export async function seedLeaveBalances(employeeId: string, year: number) {
  await supabase.from("leave_balances").insert(
    Object.entries(DEFAULT_LEAVE_ENTITLEMENTS).map(([leave_type, entitled_days]) => ({
      employee_id: employeeId,
      leave_type,
      year,
      entitled_days,
      used_days: 0,
    }))
  )
}

export async function adjustLeaveBalance(input: {
  employeeId: string
  leaveType: string
  startDate: string
  days: number
}) {
  const year = Number(input.startDate.slice(0, 4))
  const { data } = await supabase
    .from("leave_balances")
    .select("*")
    .eq("employee_id", input.employeeId)
    .eq("leave_type", input.leaveType)
    .eq("year", year)
    .maybeSingle()

  if (data) {
    const used = Math.max(0, Math.round((Number(data.used_days) + input.days) * 10) / 10)
    if (used !== Number(data.used_days)) {
      await supabase.from("leave_balances").update({ used_days: used }).eq("id", data.id)
    }
    return
  }

  if (input.days > 0) {
    await supabase.from("leave_balances").insert({
      employee_id: input.employeeId,
      leave_type: input.leaveType,
      year,
      entitled_days: DEFAULT_LEAVE_ENTITLEMENTS[input.leaveType] ?? 0,
      used_days: input.days,
    })
  }
}
