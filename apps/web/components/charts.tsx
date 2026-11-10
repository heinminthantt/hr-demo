"use client"

import type { ReactNode } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

export type ChartPoint = Record<string, string | number | null>
export type ChartSeries = { key: string; label: string; color?: string }

const compact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

function ChartTip({ active, payload, label, formatValue }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <p className="mb-1 font-medium">{String(label)}</p>}
      {payload.map((p: any) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: p.color ?? p.fill }} />
            {p.name}
          </span>
          <span className="font-medium">
            {formatValue ? formatValue(Number(p.value)) : Number(p.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

export function ChartCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function TrendChart({
  data,
  xKey,
  series,
  height = 240,
  formatValue,
  formatAxis = compact,
}: {
  data: ChartPoint[]
  xKey: string
  series: ChartSeries[]
  height?: number
  formatValue?: (n: number) => string
  formatAxis?: (n: number) => string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`trend-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          minTickGap={18}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={54}
          tickFormatter={(v) => formatAxis(Number(v))}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <Tooltip content={<ChartTip formatValue={formatValue} />} />
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            fill={`url(#trend-${s.key})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function BarSeriesChart({
  data,
  xKey,
  series,
  height = 240,
  formatValue,
  formatAxis = compact,
}: {
  data: ChartPoint[]
  xKey: string
  series: ChartSeries[]
  height?: number
  formatValue?: (n: number) => string
  formatAxis?: (n: number) => string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          minTickGap={12}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={54}
          tickFormatter={(v) => formatAxis(Number(v))}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <Tooltip content={<ChartTip formatValue={formatValue} />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={[4, 4, 0, 0]}
            maxBarSize={34}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DonutChart({
  data,
  height = 220,
  formatValue,
  centerLabel,
  centerValue,
}: {
  data: { name: string; value: number; color?: string }[]
  height?: number
  formatValue?: (n: number) => string
  centerLabel?: string
  centerValue?: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="space-y-3">
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} strokeWidth={0} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={d.name} fill={d.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTip formatValue={formatValue} />} wrapperStyle={{ zIndex: 20 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <p
            className={cn(
              "font-semibold tracking-tight",
              (centerValue ?? total.toLocaleString()).length > 14 ? "text-xs" : (centerValue ?? total.toLocaleString()).length > 9 ? "text-base" : "text-2xl"
            )}
          >
            {centerValue ?? total.toLocaleString()}
          </p>
          {centerLabel && <p className="text-muted-foreground text-xs">{centerLabel}</p>}
        </div>
      </div>
      <div className="grid gap-2">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: d.color ?? CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="truncate capitalize">{d.name.replaceAll("_", " ")}</span>
            </span>
            <span className="font-medium">{formatValue ? formatValue(d.value) : d.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HorizontalBars({
  data,
  formatValue,
  max,
  className,
}: {
  data: { label: string; value: number; hint?: string; color?: string }[]
  formatValue?: (n: number) => string
  max?: number
  className?: string
}) {
  const ceiling = max ?? Math.max(1, ...data.map((d) => d.value))
  if (data.length === 0) return <p className="text-muted-foreground py-6 text-center text-sm">No data yet.</p>
  return (
    <div className={cn("space-y-3", className)}>
      {data.map((d, i) => (
        <div key={d.label} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-medium capitalize">{d.label.replaceAll("_", " ")}</span>
            <span className="text-muted-foreground shrink-0">
              {d.hint ?? (formatValue ? formatValue(d.value) : d.value.toLocaleString())}
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(2, Math.round((Math.abs(d.value) / ceiling) * 100))}%`,
                background: d.color ?? CHART_COLORS[i % CHART_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
