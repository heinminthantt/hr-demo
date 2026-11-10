"use client"

import * as React from "react"
import {
  APPEARANCE_KEY,
  DEFAULT_APPEARANCE,
  applyAppearance,
  loadAppearance,
  type Appearance,
} from "@/lib/appearance"

type AppearanceContextValue = {
  appearance: Appearance
  setAppearance: (patch: Partial<Appearance>) => void
  resetAppearance: () => void
}

const AppearanceContext = React.createContext<AppearanceContextValue | null>(null)

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setState] = React.useState<Appearance>(DEFAULT_APPEARANCE)

  React.useEffect(() => {
    const stored = loadAppearance()
    setState(stored)
    applyAppearance(stored)
  }, [])

  const update = React.useCallback((patch: Partial<Appearance>) => {
    setState((prev) => {
      const next = { ...prev, ...patch }
      applyAppearance(next)
      try {
        localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next))
      } catch {
        // storage can be blocked in private mode
      }
      return next
    })
  }, [])

  const reset = React.useCallback(() => {
    setState(DEFAULT_APPEARANCE)
    applyAppearance(DEFAULT_APPEARANCE)
    try {
      localStorage.removeItem(APPEARANCE_KEY)
    } catch {
      // ignore
    }
  }, [])

  const value = React.useMemo(
    () => ({ appearance, setAppearance: update, resetAppearance: reset }),
    [appearance, update, reset]
  )

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance() {
  const ctx = React.useContext(AppearanceContext)
  if (!ctx) throw new Error("useAppearance must be used inside AppearanceProvider")
  return ctx
}
