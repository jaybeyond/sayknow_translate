import { useCallback, useEffect, useState } from "react"
import { storage } from "@/lib/storage"
import { secrets, SECRETS_REV_KEY } from "@/lib/secrets"
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
    // OCP binds to IPv4 127.0.0.1. On some macOS setups `localhost` is tried
    // as IPv6 ::1 first, which makes the app think OCP is down even when the
    // proxy is listening correctly.
    if (merged.provider === "ocp" && merged.baseURL.includes("localhost:3456")) {
      merged.baseURL = merged.baseURL.replace("localhost:3456", "127.0.0.1:3456")
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

  // Cross-window sync: settings window writes prefs / secrets, main reads on
  // storage event. The actual API key lives in Keychain — localStorage only
  // carries a "rev" timestamp that we treat as a signal to re-fetch.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "sayknow:" + PREFS_KEY) {
        const saved = storage.get<Partial<Prefs>>(PREFS_KEY)
        if (saved) setPrefs({ ...DEFAULTS, ...saved })
      } else if (e.key === "sayknow:" + SECRETS_REV_KEY) {
        void secrets.get().then(setApiKey)
      }
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

  const clearKey = useCallback(async () => {
    setApiKey("")
    // Logging out of OCP/Custom only zeroing apiKey isn't enough — those
    // providers don't require a key (isConnected falls back to baseURL), so
    // the login screen would never come back up. Reset the provider too.
    setPrefs((prev) => ({
      ...prev,
      provider: "openrouter",
      baseURL: OPENROUTER_BASE,
    }))
    // Awaitable so callers can close the settings window AFTER Keychain delete
    // and the rev-signal write, otherwise other windows might miss the event.
    await secrets.clear()
  }, [])

  const settings: Settings = { ...prefs, apiKey }

  // OpenRouter always needs a key. OCP / Custom can run in open mode where
  // /models works unauthenticated — for those we treat a configured baseURL
  // as "connected" so the user actually reaches TabbedPanel after Connect.
  const isLoggedIn =
    prefs.provider === "openrouter"
      ? apiKey.length > 0
      : prefs.baseURL.trim().length > 0

  return {
    settings,
    update,
    clearKey,
    isLoggedIn,
    loaded,
  }
}
