import { useCallback, useEffect, useState } from "react"
import { usage, type UsageDay } from "@/lib/usage"
import type { OpenRouterModel } from "@/lib/openrouter"

export function useUsage() {
  const [today, setToday] = useState<UsageDay>(() => usage.todaySummary())
  const [month, setMonth] = useState<UsageDay>(() => usage.monthSummary())

  useEffect(() => {
    function refresh() {
      setToday(usage.todaySummary())
      setMonth(usage.monthSummary())
    }
    function onStorage(e: StorageEvent) {
      if (e.key === "sayknow:usage") refresh()
    }
    window.addEventListener("focus", refresh)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener("focus", refresh)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const record = useCallback(
    (args: {
      modelId: string
      models: OpenRouterModel[]
      promptTokens: number
      completionTokens: number
    }) => {
      usage.record(args)
      setToday(usage.todaySummary())
      setMonth(usage.monthSummary())
    },
    [],
  )

  const clear = useCallback(() => {
    usage.clear()
    setToday(usage.todaySummary())
    setMonth(usage.monthSummary())
  }, [])

  return { today, month, record, clear }
}
