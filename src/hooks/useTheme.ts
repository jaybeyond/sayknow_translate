import { useEffect, useState } from "react"
import { storage } from "@/lib/storage"

export type ThemeMode = "system" | "light" | "dark"
const KEY = "theme"

function resolveDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true
  if (mode === "light") return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function apply(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", resolveDark(mode))
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(
    () => (storage.get<ThemeMode>(KEY) ?? "system") as ThemeMode,
  )

  useEffect(() => {
    apply(mode)
    storage.set(KEY, mode)
    if (mode !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => apply("system")
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [mode])

  return { mode, setMode }
}
