"use client"

import { cn } from "@workspace/ui/lib/utils"

export type TabItem<T extends string> = { value: T; label: string; count?: number }

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label="Sections"
      className={cn("bg-muted inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg p-1", className)}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === tab.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
          {tab.count !== undefined && <span className="text-muted-foreground ml-1.5 text-xs">{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}
