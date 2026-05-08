import { useEffect, useState } from "react"
import { storage } from "@/lib/storage"
import { fetchModels, type OpenRouterModel } from "@/lib/openrouter"

const CACHE_KEY = "models-cache"
const TTL_MS = 24 * 60 * 60 * 1000 // 24h

type Cache = { fetchedAt: number; data: OpenRouterModel[] }

export function useModels(apiKey: string) {
  const [models, setModels] = useState<OpenRouterModel[]>(() => {
    const cached = storage.get<Cache>(CACHE_KEY)
    return cached?.data ?? []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!apiKey) return
    const cached = storage.get<Cache>(CACHE_KEY)
    const fresh = cached && Date.now() - cached.fetchedAt < TTL_MS
    if (fresh && cached.data.length > 0) {
      setModels(cached.data)
      return
    }
    setLoading(true)
    setError(null)
    fetchModels(apiKey)
      .then((list) => {
        const sorted = [...list].sort((a, b) =>
          (a.name ?? a.id).localeCompare(b.name ?? b.id),
        )
        setModels(sorted)
        storage.set(CACHE_KEY, { fetchedAt: Date.now(), data: sorted })
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [apiKey])

  return { models, loading, error }
}
