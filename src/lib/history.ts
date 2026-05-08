import { storage } from "./storage"
import type { LangCode } from "./openrouter"

export type HistoryEntry = {
  id: string
  ts: number
  source: string
  target: string
  from: LangCode
  to: LangCode
  model: string
}

const KEY = "history"
const MAX = 50

export const history = {
  list(): HistoryEntry[] {
    return storage.get<HistoryEntry[]>(KEY) ?? []
  },
  add(entry: Omit<HistoryEntry, "id" | "ts">) {
    const trimmed = entry.source.trim()
    if (!trimmed || !entry.target.trim()) return
    const prev = history.list()
    // Skip exact duplicate of the most recent entry.
    if (
      prev[0] &&
      prev[0].source === entry.source &&
      prev[0].target === entry.target &&
      prev[0].from === entry.from &&
      prev[0].to === entry.to
    ) {
      return
    }
    const next: HistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      ts: Date.now(),
    }
    storage.set(KEY, [next, ...prev].slice(0, MAX))
  },
  clear() {
    storage.remove(KEY)
  },
  remove(id: string) {
    storage.set(
      KEY,
      history.list().filter((e) => e.id !== id),
    )
  },
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  if (s < 60) return "방금"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}일 전`
  return new Date(ts).toLocaleDateString("ko-KR")
}
