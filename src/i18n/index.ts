import { useCallback } from "react"
import { UI_LOCALES, UI_STRINGS, type UILocale } from "./strings"

export type UILocaleSetting = "system" | UILocale

export function detectSystemLocale(): UILocale {
  if (typeof navigator === "undefined") return "en"
  // Try language list first (Tauri WKWebView returns user prefs).
  const candidates = (navigator.languages?.length
    ? navigator.languages
    : [navigator.language]) as string[]
  for (const c of candidates) {
    const base = c.split("-")[0].toLowerCase() as UILocale
    if ((UI_LOCALES as readonly string[]).includes(base)) return base
    // Map a few region codes to base.
    if (c.toLowerCase().startsWith("zh")) return "zh"
  }
  return "en"
}

export function resolveLocale(setting: UILocaleSetting): UILocale {
  if (setting === "system") return detectSystemLocale()
  return setting
}

export function translate(locale: UILocale, key: string): string {
  return UI_STRINGS[locale]?.[key] ?? UI_STRINGS.en[key] ?? key
}

export function useT(setting: UILocaleSetting): {
  t: (key: string) => string
  locale: UILocale
} {
  const locale = resolveLocale(setting)
  const t = useCallback((key: string) => translate(locale, key), [locale])
  return { t, locale }
}

export { UI_LOCALES, UI_LOCALE_LABELS } from "./strings"
export type { UILocale } from "./strings"
