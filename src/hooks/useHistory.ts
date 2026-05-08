import { useCallback, useEffect, useState } from "react"
import { history, type HistoryEntry } from "@/lib/history"

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => history.list())

  // Re-read from storage when window regains focus (other instance changed it).
  useEffect(() => {
    function refresh() {
      setEntries(history.list())
    }
    window.addEventListener("focus", refresh)
    return () => window.removeEventListener("focus", refresh)
  }, [])

  const add = useCallback((e: Omit<HistoryEntry, "id" | "ts">) => {
    history.add(e)
    setEntries(history.list())
  }, [])

  const remove = useCallback((id: string) => {
    history.remove(id)
    setEntries(history.list())
  }, [])

  const clear = useCallback(() => {
    history.clear()
    setEntries([])
  }, [])

  return { entries, add, remove, clear }
}
