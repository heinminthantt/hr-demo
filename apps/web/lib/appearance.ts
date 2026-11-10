export type Appearance = {
  fontSize: "sm" | "md" | "lg"
  zoom: 90 | 100 | 110 | 125
  density: "comfortable" | "compact"
  radius: "sharp" | "default" | "rounded"
}

export const APPEARANCE_KEY = "hr-appearance-v1"

export const DEFAULT_APPEARANCE: Appearance = {
  fontSize: "md",
  zoom: 100,
  density: "comfortable",
  radius: "default",
}

export function loadAppearance(): Appearance {
  if (typeof localStorage === "undefined") return DEFAULT_APPEARANCE
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY)
    if (!raw) return DEFAULT_APPEARANCE
    const parsed = JSON.parse(raw) as Partial<Appearance>
    return {
      fontSize: parsed.fontSize === "sm" || parsed.fontSize === "lg" ? parsed.fontSize : "md",
      zoom: parsed.zoom === 90 || parsed.zoom === 110 || parsed.zoom === 125 ? parsed.zoom : 100,
      density: parsed.density === "compact" ? "compact" : "comfortable",
      radius: parsed.radius === "sharp" || parsed.radius === "rounded" ? parsed.radius : "default",
    }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function applyAppearance(a: Appearance) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.dataset.fontSize = a.fontSize
  root.dataset.density = a.density
  root.dataset.radius = a.radius
  root.style.fontSize = a.fontSize === "sm" ? "14px" : a.fontSize === "lg" ? "18px" : "16px"
  root.style.setProperty("zoom", String(a.zoom / 100))
}
