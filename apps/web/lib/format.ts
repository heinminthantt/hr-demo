export const todayStr = () => new Date().toLocaleDateString("en-CA") // local YYYY-MM-DD

export const monthStart = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}-01`

// last day of month m (1..12): Date(y, m, 0) -> day 0 of next 0-based month index
export const monthEnd = (y: number, m: number) => {
  const d = new Date(y, m, 0)
  return `${y}-${String(m).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export function money(n: number, currency = "MMK"): string {
  return `${new Intl.NumberFormat("en-US").format(Math.round(n || 0))} ${currency}`
}

// Attendance times: store wall-clock "HH:MM" into a timestamptz as UTC ("09:00" -> "09:00:00Z"),
// read back by slicing the ISO string. Round-trips exactly; treat the column as a time of day.
export const isoAt = (date: string, time: string) => new Date(`${date}T${time}:00Z`).toISOString()

export const timeOf = (t: string | null): string => (t ? t.slice(11, 16) : "")

export function fmtDate(d: string | null): string {
  if (!d) return "-"
  const [y, m, day] = d.slice(0, 10).split("-")
  return `${day}/${m}/${y}`
}
