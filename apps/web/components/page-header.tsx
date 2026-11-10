import Link from "next/link"
import type { ReactNode } from "react"
import { RiArrowLeftLine } from "@remixicon/react"
import { cn } from "@workspace/ui/lib/utils"

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "Back",
  actions,
  meta,
  leading,
  className,
}: {
  title: string
  description?: ReactNode
  backHref?: string
  backLabel?: string
  actions?: ReactNode
  meta?: ReactNode
  leading?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {leading}
        <div className="min-w-0 space-y-1.5">
        {backHref && (
          <Link
            href={backHref}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
          >
            <RiArrowLeftLine className="size-3.5" />
            {backLabel}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {meta}
        </div>
        {description && <div className="text-muted-foreground max-w-2xl text-sm">{description}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
