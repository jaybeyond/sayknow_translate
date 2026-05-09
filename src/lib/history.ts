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
  pinned?: boolean
}

const KEY = "history"
const MAX_UNPINNED = 50

function sortPinnedFirst(list: HistoryEntry[]): HistoryEntry[] {
  // Stable: pinned first (newest pinned at top), then unpinned by recency.
  return [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    return b.ts - a.ts
  })
}

export const history = {
  list(): HistoryEntry[] {
    return sortPinnedFirst(storage.get<HistoryEntry[]>(KEY) ?? [])
  },
  add(entry: Omit<HistoryEntry, "id" | "ts" | "pinned">) {
    const trimmed = entry.source.trim()
    if (!trimmed || !entry.target.trim()) return
    const prev = history.list()
    if (
      prev[0] &&
      !prev[0].pinned &&
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
      pinned: false,
    }
    const combined = [next, ...prev]
    // Cap only the unpinned subset.
    const pinned = combined.filter((e) => e.pinned)
    const unpinned = combined.filter((e) => !e.pinned).slice(0, MAX_UNPINNED)
    storage.set(KEY, [...pinned, ...unpinned])
  },
  togglePin(id: string) {
    const list = history.list()
    storage.set(
      KEY,
      list.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e)),
    )
  },
  clear() {
    // Pin'd 항목은 보존. 사용자 의도 보호.
    const pinned = history.list().filter((e) => e.pinned)
    if (pinned.length > 0) storage.set(KEY, pinned)
    else storage.remove(KEY)
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
