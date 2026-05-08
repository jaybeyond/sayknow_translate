import { useCallback, useEffect, useState } from "react"
import { storage } from "@/lib/storage"
import { secrets } from "@/lib/secrets"
import type { LangCode } from "@/lib/openrouter"

export type Prefs = {
  model: string
  fallbackModel: string
  from: LangCode
  to: LangCode
  autoTranslate: boolean
}

const DEFAULTS: Prefs = {
  model: "openai/gpt-4o-mini",
  fallbackModel: "",
  from: "auto",
  to: "en",
  autoTranslate: true,
}

const PREFS_KEY = "prefs"

export type Settings = Prefs & { apiKey: string }

export function useSettings() {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const saved = storage.get<Partial<Prefs>>(PREFS_KEY)
    return { ...DEFAULTS, ...(saved ?? {}) }
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
