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

export type ChatUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export type ChatResult = {
  content: string
  /** The model OpenRouter actually used to fulfill the request. */
  model: string
  usage?: ChatUsage
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
    usage?: ChatUsage
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("Empty response from model")
  return {
    content: content.trim(),
    model: data.model ?? opts.model,
    usage: data.usage,
  }
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
  { code: "auto",  label: "자동 감지", english: "Auto-detect", keywords: "auto detect" },
  // East Asia
  { code: "ko", label: "한국어",   english: "Korean",     keywords: "korean ko hangul" },
  { code: "en", label: "English",  english: "English",    keywords: "english en" },
  { code: "ja", label: "日本語",   english: "Japanese",   keywords: "japanese ja nihongo" },
  { code: "zh", label: "中文 (간체)", english: "Chinese (Simplified)", keywords: "chinese zh mandarin simplified" },
  { code: "zh-Hant", label: "中文 (번체)", english: "Chinese (Traditional)", keywords: "chinese traditional zh-hant taiwan" },
  // Southeast Asia
  { code: "vi", label: "Tiếng Việt", english: "Vietnamese", keywords: "vietnamese vi" },
  { code: "th", label: "ไทย",      english: "Thai",       keywords: "thai th" },
  { code: "id", label: "Bahasa Indonesia", english: "Indonesian", keywords: "indonesian id bahasa" },
  { code: "ms", label: "Bahasa Melayu",    english: "Malay",      keywords: "malay ms" },
  { code: "tl", label: "Filipino", english: "Filipino",   keywords: "filipino tagalog tl" },
  // South Asia
  { code: "hi", label: "हिन्दी",    english: "Hindi",      keywords: "hindi hi" },
  { code: "bn", label: "বাংলা",     english: "Bengali",    keywords: "bengali bn bangla" },
  { code: "ur", label: "اردو",      english: "Urdu",       keywords: "urdu ur" },
  { code: "ta", label: "தமிழ்",     english: "Tamil",      keywords: "tamil ta" },
  // Europe (West)
  { code: "es", label: "Español",  english: "Spanish",    keywords: "spanish es castellano" },
  { code: "fr", label: "Français", english: "French",     keywords: "french fr" },
  { code: "de", label: "Deutsch",  english: "German",     keywords: "german de deutsch" },
  { code: "it", label: "Italiano", english: "Italian",    keywords: "italian it" },
  { code: "pt", label: "Português",english: "Portuguese", keywords: "portuguese pt" },
  { code: "nl", label: "Nederlands", english: "Dutch",    keywords: "dutch nl nederlands" },
  // Europe (North)
  { code: "sv", label: "Svenska",  english: "Swedish",    keywords: "swedish sv svenska" },
  { code: "da", label: "Dansk",    english: "Danish",     keywords: "danish da dansk" },
  { code: "no", label: "Norsk",    english: "Norwegian",  keywords: "norwegian no norsk" },
  { code: "fi", label: "Suomi",    english: "Finnish",    keywords: "finnish fi suomi" },
  // Europe (East)
  { code: "ru", label: "Русский",  english: "Russian",    keywords: "russian ru" },
  { code: "uk", label: "Українська", english: "Ukrainian", keywords: "ukrainian uk" },
  { code: "pl", label: "Polski",   english: "Polish",     keywords: "polish pl polski" },
  { code: "cs", label: "Čeština",  english: "Czech",      keywords: "czech cs cestina" },
  { code: "hu", label: "Magyar",   english: "Hungarian",  keywords: "hungarian hu magyar" },
  { code: "ro", label: "Română",   english: "Romanian",   keywords: "romanian ro romana" },
  { code: "el", label: "Ελληνικά", english: "Greek",      keywords: "greek el" },
  { code: "bg", label: "Български",english: "Bulgarian",  keywords: "bulgarian bg" },
  // Middle East / Africa
  { code: "ar", label: "العربية",  english: "Arabic",     keywords: "arabic ar" },
  { code: "he", label: "עברית",    english: "Hebrew",     keywords: "hebrew he ivrit" },
  { code: "fa", label: "فارسی",    english: "Persian",    keywords: "persian farsi fa" },
  { code: "tr", label: "Türkçe",   english: "Turkish",    keywords: "turkish tr turkce" },
  { code: "sw", label: "Kiswahili",english: "Swahili",    keywords: "swahili sw kiswahili" },
] as const

export type LangCode = (typeof LANGS)[number]["code"]

export function langLabel(code: string): string {
  return LANGS.find((l) => l.code === code)?.english ?? code
}

export type GlossaryPair = { source: string; target: string }

export const DEFAULT_TRANSLATE_PROMPT =
  "You are a professional translator. Translate the user's text naturally and concisely. " +
  "Preserve meaning, tone, and formatting. Output ONLY the translation, no explanations, no quotes."

export const DEFAULT_REFINE_PROMPT =
  "You are a professional translator. Revise the existing translation per the user's instruction. " +
  "Output ONLY the revised translation, no explanations, no quotes."

function glossaryClause(glossary?: GlossaryPair[]): string {
  const entries = (glossary ?? []).filter(
    (g) => g.source.trim() && g.target.trim(),
  )
  if (entries.length === 0) return ""
  const lines = entries.map((g) => `- "${g.source}" → "${g.target}"`).join("\n")
  return (
    "\n\nGlossary — always translate these terms exactly as specified " +
    "(case-insensitive matching, preserve surrounding text):\n" +
    lines
  )
}

function applyTemplate(
  template: string,
  vars: { from: string; to: string; glossary: string },
): string {
  return template
    .replace(/\{from\}/g, vars.from)
    .replace(/\{to\}/g, vars.to)
    .replace(/\{glossary\}/g, vars.glossary)
}

export type PromptOverrides = {
  translate?: string
  refine?: string
}

export function buildTranslatePrompt(
  text: string,
  from: LangCode,
  to: LangCode,
  glossary?: GlossaryPair[],
  overrides?: PromptOverrides,
): ChatMessage[] {
  const sourceLine =
    from === "auto" ? "Detect the source language." : `Source language: ${langLabel(from)}.`
  const baseSystem = overrides?.translate?.trim()
    ? applyTemplate(overrides.translate, {
        from: from === "auto" ? "auto-detect" : langLabel(from),
        to: langLabel(to),
        glossary: glossaryClause(glossary).trim(),
      })
    : DEFAULT_TRANSLATE_PROMPT + glossaryClause(glossary)
  return [
    { role: "system", content: baseSystem },
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
  glossary?: GlossaryPair[],
  overrides?: PromptOverrides,
): ChatMessage[] {
  const baseSystem = overrides?.refine?.trim()
    ? applyTemplate(overrides.refine, {
        from: "",
        to: langLabel(to),
        glossary: glossaryClause(glossary).trim(),
      })
    : DEFAULT_REFINE_PROMPT + glossaryClause(glossary)
  return [
    { role: "system", content: baseSystem },
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
