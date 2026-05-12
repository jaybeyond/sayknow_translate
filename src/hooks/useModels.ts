import { useEffect, useState } from "react"
import { storage } from "@/lib/storage"
import {
  CLAUDE_CLI_MODELS,
  fetchModels,
  type OpenRouterModel,
} from "@/lib/openrouter"

const CACHE_KEY_PREFIX = "models-cache"
const TTL_MS = 24 * 60 * 60 * 1000 // 24h

type Cache = { fetchedAt: number; data: OpenRouterModel[] }

function cacheKey(baseURL: string): string {
  return `${CACHE_KEY_PREFIX}:${baseURL}`
}

/** OCP runs on localhost:3456 by default. Loose match so 127.0.0.1 and
 *  slight URL variations all qualify for the Claude-model fallback. */
function isOcpLike(baseURL: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\b/.test(baseURL)
}

export function useModels(apiKey: string, baseURL: string) {
  const ocpLike = isOcpLike(baseURL)
  const [models, setModels] = useState<OpenRouterModel[]>(() => {
    const cached = storage.get<Cache>(cacheKey(baseURL))
    return cached?.data ?? (ocpLike ? CLAUDE_CLI_MODELS : [])
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!baseURL) return
    // For OCP-style endpoints, prime the dropdown with known Claude models
    // so it's never empty while the network probe is in flight.
    if (ocpLike) {
      setModels((prev) => (prev.length === 0 ? CLAUDE_CLI_MODELS : prev))
    }
    if (!apiKey && !ocpLike) return
    const key = cacheKey(baseURL)
    const cached = storage.get<Cache>(key)
    const fresh = cached && Date.now() - cached.fetchedAt < TTL_MS
    if (fresh && cached.data.length > 0) {
      setModels(cached.data)
      return
    }
    setLoading(true)
    setError(null)
    fetchModels(apiKey, baseURL)
      .then((list) => {
        // Empty list from OCP / Ollama is common before they're configured —
        // keep the fallback list rather than showing an empty dropdown.
        if (list.length === 0 && ocpLike) return
        const sorted = [...list].sort((a, b) =>
          (a.name ?? a.id).localeCompare(b.name ?? b.id),
        )
        setModels(sorted)
        storage.set(key, { fetchedAt: Date.now(), data: sorted })
      })
      .catch((e) => {
        if (ocpLike) {
          setModels((prev) => (prev.length === 0 ? CLAUDE_CLI_MODELS : prev))
          return
        }
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setLoading(false))
  }, [apiKey, baseURL, ocpLike])

  return { models, loading, error }
}
