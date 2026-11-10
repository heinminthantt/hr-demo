import type { ReactNode } from "react"

// Placeholder page for modules planned in a later phase.
export function Stub({ title, what }: { title: string; what: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 py-24 text-center">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm">{what}</p>
      <span className="text-muted-foreground mt-4 font-mono text-xs">Planned - not built yet</span>
    </div>
  )
}

export default function StubPage({
  title,
  what,
}: {
  title: string
  what: ReactNode | string
}) {
  return <Stub title={title} what={String(what)} />
}
