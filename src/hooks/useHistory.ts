import { useCallback, useEffect, useState } from "react"
import { history, type HistoryEntry } from "@/lib/history"

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => history.list())

  // Re-read from storage on focus or when another window writes history.
  useEffect(() => {
    function refresh() {
      setEntries(history.list())
    }
    function onStorage(e: StorageEvent) {
      if (e.key === "sayknow:history") refresh()
    }
    window.addEventListener("focus", refresh)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener("focus", refresh)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const add = useCallback((e: Omit<HistoryEntry, "id" | "ts">) => {
    history.add(e)
    setEntries(history.list())
  }, [])

  const remove = useCallback((id: string) => {
    history.remove(id)
    setEntries(history.list())
  }, [])

  const togglePin = useCallback((id: string) => {
    history.togglePin(id)
    setEntries(history.list())
  }, [])

  const clear = useCallback(() => {
    history.clear()
    setEntries(history.list())
  }, [])

  return { entries, add, remove, togglePin, clear }
}
