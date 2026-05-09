import { storage } from "./storage"

export type ChatRole = "user" | "assistant"

export type ChatMsg = {
  id: string
  role: ChatRole
  content: string
  ts: number
  /** Model id that produced this assistant turn (assistant only). */
  model?: string
}

export type Conversation = {
  id: string
  title: string
  messages: ChatMsg[]
  createdAt: number
  updatedAt: number
}

const CONVS_KEY = "conversations"
const CURRENT_KEY = "current-conversation"
const LEGACY_HISTORY_KEY = "chat-history"

const MAX_CONVS = 100
const MAX_MSGS_PER_CONV = 200

function genId(): string {
  return crypto.randomUUID()
}

function genTitle(messages: ChatMsg[]): string {
  const first = messages.find((m) => m.role === "user")?.content?.trim() ?? ""
  if (!first) return "새 대화"
  return first.length > 32 ? first.slice(0, 32).trimEnd() + "…" : first
}

function migrateLegacy(): void {
  const oldMsgs = storage.get<ChatMsg[]>(LEGACY_HISTORY_KEY)
  const existingConvs = storage.get<Conversation[]>(CONVS_KEY)
  if (!oldMsgs || !oldMsgs.length || (existingConvs && existingConvs.length))
    return
  const now = Date.now()
  const conv: Conversation = {
    id: genId(),
    title: genTitle(oldMsgs),
    messages: oldMsgs.slice(-MAX_MSGS_PER_CONV),
    createdAt: oldMsgs[0]?.ts ?? now,
    updatedAt: oldMsgs[oldMsgs.length - 1]?.ts ?? now,
  }
  storage.set(CONVS_KEY, [conv])
  storage.set(CURRENT_KEY, conv.id)
  storage.remove(LEGACY_HISTORY_KEY)
}

migrateLegacy()

function readAll(): Conversation[] {
  return storage.get<Conversation[]>(CONVS_KEY) ?? []
}

function writeAll(list: Conversation[]) {
  storage.set(CONVS_KEY, list.slice(0, MAX_CONVS))
}

export const conversations = {
  list(): Conversation[] {
    // Most recently updated first.
    return [...readAll()].sort((a, b) => b.updatedAt - a.updatedAt)
  },
  get(id: string): Conversation | null {
    return readAll().find((c) => c.id === id) ?? null
  },
  currentId(): string | null {
    return storage.get<string>(CURRENT_KEY)
  },
  setCurrent(id: string | null) {
    if (id) storage.set(CURRENT_KEY, id)
    else storage.remove(CURRENT_KEY)
  },
  create(): Conversation {
    const now = Date.now()
    const conv: Conversation = {
      id: genId(),
      title: "새 대화",
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
    writeAll([conv, ...readAll()])
    storage.set(CURRENT_KEY, conv.id)
    return conv
  },
  delete(id: string) {
    const all = readAll().filter((c) => c.id !== id)
    writeAll(all)
    if (storage.get<string>(CURRENT_KEY) === id) {
      const next = all[0]?.id ?? null
      conversations.setCurrent(next)
    }
  },
  rename(id: string, title: string) {
    const all = readAll()
    const idx = all.findIndex((c) => c.id === id)
    if (idx < 0) return
    all[idx] = { ...all[idx], title, updatedAt: Date.now() }
    writeAll(all)
  },
  /** Append a message to the conversation. Auto-generates title if first user msg. */
  appendMessage(id: string, msg: Omit<ChatMsg, "id" | "ts">): ChatMsg {
    const all = readAll()
    const idx = all.findIndex((c) => c.id === id)
    if (idx < 0) throw new Error("conversation not found: " + id)
    const next: ChatMsg = { ...msg, id: genId(), ts: Date.now() }
    const conv = all[idx]
    const messages = [...conv.messages, next].slice(-MAX_MSGS_PER_CONV)
    const isFirstUser = msg.role === "user" && !conv.messages.some((m) => m.role === "user")
    all[idx] = {
      ...conv,
      messages,
      title: isFirstUser ? genTitle(messages) : conv.title,
      updatedAt: next.ts,
    }
    writeAll(all)
    return next
  },
  /** Replace the entire message list (used by truncate / edit / regenerate). */
  setMessages(id: string, messages: ChatMsg[]) {
    const all = readAll()
    const idx = all.findIndex((c) => c.id === id)
    if (idx < 0) return
    all[idx] = {
      ...all[idx],
      messages: messages.slice(-MAX_MSGS_PER_CONV),
      updatedAt: Date.now(),
    }
    writeAll(all)
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
  return new Date(ts).toLocaleDateString()
}
