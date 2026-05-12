import { useEffect, useState } from "react"
import { isTauri } from "@/lib/runtime"

async function probeFetch(url: string, init?: RequestInit): Promise<Response> {
  if (isTauri()) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http")
    return tauriFetch(url, init)
  }
  return fetch(url, init)
}

export type ProbeStatus =
  | "idle"
  | "checking"
  | "ready"
  | "auth-required"
  | "down"

/**
 * Pings `${baseURL}/models` and reports whether the endpoint is reachable
 * and whether it needs auth. Used to auto-detect OCP / custom endpoints.
 */
export function useProviderProbe(
  baseURL: string,
  apiKey: string,
  enabled: boolean,
): ProbeStatus {
  const [status, setStatus] = useState<ProbeStatus>("idle")

  useEffect(() => {
    if (!enabled || !baseURL) {
      setStatus("idle")
      return
    }
    let cancelled = false
    setStatus("checking")

    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), 4000)

    probeFetch(`${baseURL.replace(/\/$/, "")}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: ctrl.signal,
    })
      .then((res) => {
        if (cancelled) return
        if (res.ok) setStatus("ready")
        else if (res.status === 401 || res.status === 403)
          setStatus("auth-required")
        else setStatus("down")
      })
      .catch(() => {
        if (!cancelled) setStatus("down")
      })
      .finally(() => {
        window.clearTimeout(timer)
      })

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      ctrl.abort()
    }
  }, [baseURL, apiKey, enabled])

  return status
}
