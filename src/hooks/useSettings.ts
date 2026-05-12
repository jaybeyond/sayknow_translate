import { useCallback, useEffect, useState } from "react"
import { storage } from "@/lib/storage"
import { secrets } from "@/lib/secrets"
import { OPENROUTER_BASE, type LangCode, type ProviderId } from "@/lib/openrouter"
import type { UILocaleSetting } from "@/i18n"

export type GlossaryTerm = { source: string; target: string }

export type Prefs = {
  provider: ProviderId
  /** OpenAI-compatible endpoint base URL (e.g. https://openrouter.ai/api/v1). */
  baseURL: string
  model: string
  fallbackModel: string
  from: LangCode
  to: LangCode
  autoTranslate: boolean
  pinned: boolean
  /** When true, opening the window via global shortcut auto-fills clipboard text. */
  clipboardOnHotkey: boolean
  /** Term consistency rules. Injected into system prompt. */
  glossary: GlossaryTerm[]
  /** UI language. "system" follows OS locale; otherwise explicit override. */
  uiLocale: UILocaleSetting
  /** Optional override for the translate system prompt. Empty = use default. */
  customTranslatePrompt: string
  /** Optional override for the refine system prompt. Empty = use default. */
  customRefinePrompt: string
  /** Compact mode shrinks the popover; useful when pinned alongside other apps. */
  windowMode: "compact" | "normal"
}

const DEFAULTS: Prefs = {
  provider: "openrouter",
  baseURL: OPENROUTER_BASE,
  model: "openai/gpt-4o-mini",
  fallbackModel: "",
  from: "auto",
  to: "en",
  autoTranslate: true,
  pinned: false,
  clipboardOnHotkey: false,
  glossary: [],
  uiLocale: "system",
  customTranslatePrompt: "",
  customRefinePrompt: "",
  windowMode: "normal",
}

const PREFS_KEY = "prefs"

export type Settings = Prefs & { apiKey: string }

export function useSettings() {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const saved = storage.get<Partial<Prefs>>(PREFS_KEY)
    const merged: Prefs = { ...DEFAULTS, ...(saved ?? {}) }
    // Migrate retired providers (claude-cli was removed in favor of OCP).
    if ((merged.provider as string) === "claude-cli") {
      merged.provider = "openrouter"
      merged.baseURL = OPENROUTER_BASE
    }
    return merged
  })
  const [apiKey, setApiKey] = useState<string>("")
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    secrets
      .get()
      .then((v) => setApiKey(v))
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    storage.set(PREFS_KEY, prefs)
  }, [prefs])

  // Cross-window sync: settings window writes prefs, main reads on storage event.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== "sayknow:" + PREFS_KEY) return
      const saved = storage.get<Partial<Prefs>>(PREFS_KEY)
      if (saved) setPrefs({ ...DEFAULTS, ...saved })
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const update = useCallback((patch: Partial<Settings>) => {
    if (patch.apiKey !== undefined) {
      const next = patch.apiKey
      setApiKey(next)
      void secrets.set(next)
    }
    const { apiKey: _omit, ...rest } = patch
    void _omit
    if (Object.keys(rest).length > 0) {
      setPrefs((prev) => ({ ...prev, ...(rest as Partial<Prefs>) }))
    }
  }, [])

  const clearKey = useCallback(() => {
    setApiKey("")
    void secrets.clear()
  }, [])

  const settings: Settings = { ...prefs, apiKey }

  return {
    settings,
    update,
    clearKey,
    isLoggedIn: apiKey.length > 0,
    loaded,
  }
}
