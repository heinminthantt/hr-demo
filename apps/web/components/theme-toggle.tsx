"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { RiComputerLine, RiMoonLine, RiSunLine } from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Toggle theme">
        <RiSunLine />
      </Button>
    )
  }

  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light"
  const Icon = theme === "dark" ? RiMoonLine : theme === "system" ? RiComputerLine : RiSunLine
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Theme: ${theme ?? "system"}. Switch to ${next}`}
      title={`Theme: ${theme ?? "system"}`}
      onClick={() => setTheme(next)}
    >
      <Icon />
    </Button>
  )
}
