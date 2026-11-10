import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

const POSITIVE = new Set(["active", "approved", "reimbursed", "finalized", "present", "done", "hired", "valid", "open"])
const WARNING = new Set(["pending", "draft", "half_day", "maintenance", "screening", "interview", "offer", "soon", "doing"])
const NEGATIVE = new Set(["rejected", "absent", "resigned", "expired", "overdue"])
const NEUTRAL = new Set(["leave", "holiday", "todo", "closed", "applied", "other", "retired"])

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const value = status || "unknown"
  const tone = POSITIVE.has(value)
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : WARNING.has(value)
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : NEGATIVE.has(value)
        ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
        : NEUTRAL.has(value)
          ? "border-border bg-muted text-muted-foreground"
          : "border-border text-foreground"
  return (
    <Badge variant="outline" className={cn("capitalize", tone, className)}>
      {value.replaceAll("_", " ")}
    </Badge>
  )
}
