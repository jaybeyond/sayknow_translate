import { useCallback, useEffect, useRef, useState } from "react"
import {
  conversations,
  type ChatMsg,
  type Conversation,
} from "@/lib/chat-history"
import { chat as openrouterChat, type ChatMessage } from "@/lib/openrouter"

const SYSTEM_PROMPT =
  "You are a helpful, concise assistant. Answer in the user's language. " +
  "Keep responses focused and to the point — no filler, no unnecessary preamble."

type Args = {
  apiKey: string
  baseURL: string
  model: string
  fallbackModel?: string
}

export function useChat({ apiKey, baseURL, model, fallbackModel }: Args) {
  const [list, setList] = useState<Conversation[]>(() => conversations.list())
  const [currentId, setCurrentId] = useState<string | null>(
    () => conversations.currentId(),
  )
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const refresh = useCallback(() => {
    setList(conversations.list())
    setCurrentId(conversations.currentId())
  }, [])

  // Cross-window sync.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "sayknow:conversations" || e.key === "sayknow:current-conversation") {
        refresh()
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [refresh])

  function ensureCurrent(): Conversation {
    let id = currentId
    if (!id) {
      const conv = conversations.create()
      id = conv.id
      setCurrentId(id)
      setList(conversations.list())
      return conv
    }
    const found = conversations.get(id)
    if (found) return found
    // Stored id no longer exists — create fresh.
    const conv = conversations.create()
    setCurrentId(conv.id)
    setList(conversations.list())
    return conv
  }

  const current: Conversation | null = currentId
    ? list.find((c) => c.id === currentId) ?? null
    : null
  const messages: ChatMsg[] = current?.messages ?? []

  const requestAssistant = useCallback(
    async (convId: string, currentMessages: ChatMsg[]) => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      setError(null)
      setSending(true)

      const apiMessages: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
        ...currentMessages.map<ChatMessage>((m) => ({
          role: m.role,
          content: m.content,
        })),
      ]

      try {
        const result = await openrouterChat({
          apiKey,
          baseURL,
          model,
          fallbackModel,
          messages: apiMessages,
          signal: ctrl.signal,
        })
        if (ctrl.signal.aborted) return
        conversations.appendMessage(convId, {
          role: "assistant",
          content: result.content,
          model: result.model,
        })
        refresh()
      } catch (e) {
        if (ctrl.signal.aborted) return
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!ctrl.signal.aborted) setSending(false)
      }
    },
    [apiKey, baseURL, model, fallbackModel, refresh],
  )

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const conv = ensureCurrent()
      conversations.appendMessage(conv.id, { role: "user", content: trimmed })
      refresh()
      const next = conversations.get(conv.id)?.messages ?? []
      await requestAssistant(conv.id, next)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requestAssistant, currentId],
  )

  const regenerate = useCallback(
    async (assistantId: string) => {
      if (!currentId) return
      const conv = conversations.get(currentId)
      if (!conv) return
      const idx = conv.messages.findIndex((m) => m.id === assistantId)
      if (idx < 0) return
      if (conv.messages[idx].role !== "assistant") return
      const trimmed = conv.messages.slice(0, idx)
      const last = trimmed[trimmed.length - 1]
      if (!last || last.role !== "user") return
      conversations.setMessages(currentId, trimmed)
      refresh()
      await requestAssistant(currentId, trimmed)
    },
    [currentId, refresh, requestAssistant],
  )

  const editAndResend = useCallback(
    async (userId: string, newText: string) => {
      const trimmed = newText.trim()
      if (!trimmed || !currentId) return
      const conv = conversations.get(currentId)
      if (!conv) return
      const idx = conv.messages.findIndex((m) => m.id === userId)
      if (idx < 0) return
      if (conv.messages[idx].role !== "user") return
      conversations.setMessages(currentId, conv.messages.slice(0, idx))
      refresh()
      await send(trimmed)
    },
    [currentId, refresh, send],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setSending(false)
  }, [])

  const newConversation = useCallback(() => {
    abortRef.current?.abort()
    setSending(false)
    setError(null)
    const conv = conversations.create()
    setCurrentId(conv.id)
    setList(conversations.list())
  }, [])

  const switchTo = useCallback((id: string) => {
    abortRef.current?.abort()
    setSending(false)
    setError(null)
    conversations.setCurrent(id)
    setCurrentId(id)
  }, [])

  const deleteConversation = useCallback((id: string) => {
    abortRef.current?.abort()
    setSending(false)
    conversations.delete(id)
    refresh()
  }, [refresh])

  const rename = useCallback((id: string, title: string) => {
    conversations.rename(id, title)
    refresh()
  }, [refresh])

  return {
    list,
    current,
    messages,
    sending,
    error,
    setError,
    send,
    stop,
    regenerate,
    editAndResend,
    newConversation,
    switchTo,
    deleteConversation,
    rename,
  }
}
