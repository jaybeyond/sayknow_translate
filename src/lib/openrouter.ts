export const OPENROUTER_BASE = "https://openrouter.ai/api/v1"

export type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export type ChatOptions = {
  apiKey: string
  model: string
  /** Optional fallback model. Sent to OpenRouter as the second item in `models`
   *  so OpenRouter retries server-side if the primary fails (rate limit / down). */
  fallbackModel?: string
  messages: ChatMessage[]
  signal?: AbortSignal
  temperature?: number
}

export type ChatResult = {
  content: string
  /** The model OpenRouter actually used to fulfill the request. */
  model: string
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const fallback = opts.fallbackModel?.trim()
  const body: Record<string, unknown> = {
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
  }
  if (fallback && fallback !== opts.model) {
    // OpenRouter routes through this list in order on failure.
    body.models = [opts.model, fallback]
  } else {
    body.model = opts.model
  }

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "SayKnow",
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(
      `OpenRouter ${res.status}: ${text.slice(0, 200) || res.statusText}`,
    )
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
    model?: string
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("Empty response from model")
  return { content: content.trim(), model: data.model ?? opts.model }
}

export async function verifyKey(apiKey: string): Promise<boolean> {
  const res = await fetch(`${OPENROUTER_BASE}/auth/key`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  return res.ok
}

export type OpenRouterModel = {
  id: string
  name: string
  context_length?: number
  pricing?: { prompt?: string; completion?: string }
}

export async function fetchModels(apiKey: string): Promise<OpenRouterModel[]> {
  const res = await fetch(`${OPENROUTER_BASE}/models`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  })
  if (!res.ok) throw new Error(`models ${res.status}`)
  const data = (await res.json()) as { data?: OpenRouterModel[] }
  return data.data ?? []
}

export const LANGS = [
  { code: "auto", label: "자동 감지" },
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "vi", label: "Tiếng Việt" },
] as const

export type LangCode = (typeof LANGS)[number]["code"]

export function langLabel(code: string): string {
  return LANGS.find((l) => l.code === code)?.label ?? code
}

export function buildTranslatePrompt(
  text: string,
  from: LangCode,
  to: LangCode,
): ChatMessage[] {
  const sourceLine =
    from === "auto" ? "Detect the source language." : `Source language: ${langLabel(from)}.`
  return [
    {
      role: "system",
      content:
        "You are a professional translator. Translate the user's text naturally and concisely. " +
        "Preserve meaning, tone, and formatting. Output ONLY the translation, no explanations, no quotes.",
    },
    {
      role: "user",
      content: `${sourceLine}\nTarget language: ${langLabel(to)}.\n\nText:\n${text}`,
    },
  ]
}

export function buildRefinePrompt(
  original: string,
  current: string,
  to: LangCode,
  instruction: string,
): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are a professional translator. Revise the existing translation per the user's instruction. " +
        "Output ONLY the revised translation, no explanations, no quotes.",
    },
    {
      role: "user",
      content:
        `Target language: ${langLabel(to)}.\n` +
        `Instruction: ${instruction}\n\n` +
        `Original:\n${original}\n\n` +
        `Current translation:\n${current}`,
    },
  ]
}
