"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { CrudTable, type CrudOption } from "@/components/crud-table"
import { PageHeader } from "@/components/page-header"
import { ChartCard, DonutChart, HorizontalBars, TrendChart } from "@/components/charts"
import { supabase } from "@/lib/supabase"
import { fmtDate, money, todayStr } from "@/lib/format"
import { recentMonths } from "@/lib/hr"

type Vehicle = { id: string; plate_no: string; model: string | null; status: string }
type FuelLog = { id: string; vehicle_id: string; log_date: string; liters: number; cost: number }
type Maintenance = { id: string; vehicle_id: string; service_date: string; description: string; cost: number; next_due: string | null }

const sum = (rows: number[]) => rows.reduce((s, n) => s + Number(n || 0), 0)
const VEHICLE_STATUS_COLORS: Record<string, string> = { active: "#10b981", maintenance: "#f59e0b", retired: "#64748b" }

const VEHICLE_STATUSES: CrudOption[] = [
  { value: "active", label: "Active" },
  { value: "maintenance", label: "Maintenance" },
  { value: "retired", label: "Retired" },
]

export default function FuelVehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([])
  const [maintenance, setMaintenance] = useState<Maintenance[]>([])

  const loadVehicles = useCallback(async () => {
    const [{ data: vehicleRows }, { data: fuelRows }, { data: maintenanceRows }] = await Promise.all([
      supabase.from("vehicles").select("id, plate_no, model, status").order("plate_no"),
      supabase.from("fuel_logs").select("id, vehicle_id, log_date, liters, cost").order("log_date", { ascending: false }),
      supabase.from("vehicle_maintenance").select("*").order("service_date", { ascending: false }),
    ])
    setVehicles((vehicleRows as Vehicle[]) ?? [])
    setFuelLogs((fuelRows as FuelLog[]) ?? [])
    setMaintenance((maintenanceRows as Maintenance[]) ?? [])
  }, [])

  useEffect(() => {
    loadVehicles()
  }, [loadVehicles])

  const byId = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])
  const vehicleOptions = vehicles.map((v) => ({ value: v.id, label: `${v.plate_no}${v.model ? ` - ${v.model}` : ""}` }))
  const plateOf = (id: string) => byId.get(id)?.plate_no ?? "(deleted)"

  const totalLiters = sum(fuelLogs.map((f) => f.liters))
  const totalFuelCost = sum(fuelLogs.map((f) => f.cost))
  const totalMaintenance = sum(maintenance.map((m) => m.cost))
  const avgPrice = totalLiters > 0 ? totalFuelCost / totalLiters : 0

  const statusMix = ["active", "maintenance", "retired"]
    .map((status) => ({ name: status, value: vehicles.filter((v) => v.status === status).length, color: VEHICLE_STATUS_COLORS[status] }))
    .filter((d) => d.value > 0)

  const costPerVehicle = [...byId.values()]
    .map((v) => ({
      label: v.plate_no,
      value: sum(fuelLogs.filter((f) => f.vehicle_id === v.id).map((f) => f.cost)),
      hint: money(sum(fuelLogs.filter((f) => f.vehicle_id === v.id).map((f) => f.cost))),
    }))
    .sort((a, b) => b.value - a.value)

  const monthly = recentMonths(6).map(({ label, key }) => ({
    month: label.slice(0, 3),
    fuel: sum(fuelLogs.filter((f) => f.log_date.startsWith(key)).map((f) => f.cost)),
    maintenance: sum(maintenance.filter((m) => m.service_date.startsWith(key)).map((m) => m.cost)),
  }))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fuel & Vehicles"
        description="Company fleet, fuel spend and maintenance history."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Fuel spend" value={money(totalFuelCost)} hint={`${fuelLogs.length} fuel log(s)`} />
        <Stat label="Fuel volume" value={`${totalLiters.toLocaleString()} L`} hint={`avg ${money(avgPrice)} per liter`} />
        <Stat label="Maintenance spend" value={money(totalMaintenance)} hint={`${maintenance.length} service record(s)`} />
        <Stat label="Fleet" value={`${vehicles.length} vehicle(s)`} hint={`${vehicles.filter((v) => v.status === "maintenance").length} in maintenance`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <ChartCard className="lg:col-span-7" title="Fleet cost" description="Fuel and maintenance cost over the last six months.">
          <TrendChart
            data={monthly}
            xKey="month"
            series={[
              { key: "fuel", label: "Fuel", color: "var(--chart-2)" },
              { key: "maintenance", label: "Maintenance", color: "var(--chart-4)" },
            ]}
            formatValue={(n) => money(n)}
            height={240}
          />
        </ChartCard>
        <ChartCard className="lg:col-span-5" title="Fleet status" description="Vehicles by current state.">
          <DonutChart data={statusMix} centerValue={String(vehicles.length)} centerLabel="vehicles" formatValue={(n) => `${n} vehicle(s)`} height={210} />
        </ChartCard>

        <ChartCard className="lg:col-span-12" title="Fuel cost per vehicle" description="Total fuel spend by plate number.">
          <HorizontalBars data={costPerVehicle} formatValue={(n) => money(n)} />
        </ChartCard>
      </div>

      <CrudTable
        title="Vehicles"
        table="vehicles"
        addLabel="+ New vehicle"
        onChanged={loadVehicles}
        fields={[
          { key: "plate_no", label: "Plate no.", required: true },
          { key: "model", label: "Model" },
          { key: "driver_name", label: "Driver" },
          { key: "status", label: "Status", type: "select", optionsKey: "vehicleStatus", defaultValue: "active" },
        ]}
        options={{ vehicleStatus: VEHICLE_STATUSES }}
        searchKeys={["plate_no", "model", "driver_name"]}
        columns={[
          { key: "plate_no", label: "Plate", render: (r) => <span className="font-mono text-xs">{r.plate_no}</span> },
          { key: "model", label: "Model" },
          { key: "driver_name", label: "Driver" },
          {
            key: "status",
            label: "Status",
            render: (r) => <Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge>,
          },
        ]}
      />

      <CrudTable
        title="Fuel logs"
        table="fuel_logs"
        addLabel="+ New fuel log"
        onChanged={loadVehicles}
        fields={[
          { key: "vehicle_id", label: "Vehicle", type: "select", optionsKey: "vehicle", required: true },
          { key: "log_date", label: "Date", type: "date", required: true, defaultValue: todayStr() },
          { key: "liters", label: "Liters", type: "number" },
          { key: "cost", label: "Cost (MMK)", type: "number" },
          { key: "odometer", label: "Odometer (km)", type: "number" },
          { key: "notes", label: "Notes", type: "textarea" },
        ]}
        options={{ vehicle: vehicleOptions }}
        searchKeys={["notes"]}
        columns={[
          { key: "vehicle_id", label: "Vehicle", render: (r) => plateOf(r.vehicle_id) },
          { key: "log_date", label: "Date", render: (r) => fmtDate(r.log_date) },
          { key: "liters", label: "Liters", align: "right" },
          { key: "cost", label: "Cost", align: "right", render: (r) => money(Number(r.cost)) },
          {
            key: "odometer",
            label: "Odometer",
            align: "right",
            render: (r) => (r.odometer === null ? "-" : `${Number(r.odometer).toLocaleString()} km`),
          },
        ]}
      />

      <CrudTable
        title="Maintenance"
        table="vehicle_maintenance"
        addLabel="+ New service"
        onChanged={loadVehicles}
        fields={[
          { key: "vehicle_id", label: "Vehicle", type: "select", optionsKey: "vehicle", required: true },
          { key: "service_date", label: "Service date", type: "date", required: true, defaultValue: todayStr() },
          { key: "description", label: "Description", required: true },
          { key: "cost", label: "Cost (MMK)", type: "number" },
          { key: "odometer", label: "Odometer (km)", type: "number" },
          { key: "next_due", label: "Next due", type: "date" },
        ]}
        options={{ vehicle: vehicleOptions }}
        searchKeys={["description"]}
        columns={[
          { key: "vehicle_id", label: "Vehicle", render: (r) => plateOf(r.vehicle_id) },
          { key: "service_date", label: "Service date", render: (r) => fmtDate(r.service_date) },
          { key: "description", label: "Description" },
          { key: "cost", label: "Cost", align: "right", render: (r) => money(Number(r.cost)) },
          {
            key: "odometer",
            label: "Odometer",
            align: "right",
            render: (r) => (r.odometer === null ? "-" : `${Number(r.odometer).toLocaleString()} km`),
          },
          { key: "next_due", label: "Next due", render: (r) => fmtDate(r.next_due) },
        ]}
      />
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-1 truncate text-xl font-semibold tracking-tight">{value}</p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">{hint}</p>
      </CardContent>
    </Card>
  )
}
