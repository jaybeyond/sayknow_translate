import { useEffect, useRef, useState } from "react"
import {
  ArrowLeftRight,
  Check,
  Copy,
  CornerDownLeft,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  X,
  Zap,
  ZapOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { ModelPicker } from "./ModelPicker"
import { HistoryMenu } from "./HistoryMenu"
import { useDebounce } from "@/hooks/useDebounce"
import { useModels } from "@/hooks/useModels"
import { useHistory } from "@/hooks/useHistory"
import type { Settings } from "@/hooks/useSettings"
import type { ThemeMode } from "@/hooks/useTheme"
import type { HistoryEntry } from "@/lib/history"
import {
  buildRefinePrompt,
  buildTranslatePrompt,
  chat,
  LANGS,
  type LangCode,
} from "@/lib/openrouter"

const REFINE_PRESETS = [
  { id: "polite", label: "정중히", instruction: "Make it more polite and formal." },
  { id: "casual", label: "캐주얼", instruction: "Make it more casual and friendly." },
  { id: "shorter", label: "짧게", instruction: "Make it shorter and more concise." },
  { id: "business", label: "비즈니스", instruction: "Use a professional business email tone." },
  { id: "literal", label: "직역", instruction: "Make it more literal." },
] as const

type Props = {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  onLogout: () => void
  themeMode: ThemeMode
  setThemeMode: (m: ThemeMode) => void
}

export function TranslatePanel({
  settings,
  update,
  onLogout,
  themeMode,
  setThemeMode,
}: Props) {
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [translating, setTranslating] = useState(false)
  const [refining, setRefining] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refineText, setRefineText] = useState("")
  const abortRef = useRef<AbortController | null>(null)
  const { models, loading: modelsLoading } = useModels(settings.apiKey)
  const { entries: historyEntries, add: addHistory, remove: removeHistory, clear: clearHistory } =
    useHistory()

  const debounced = useDebounce(input, 1500)

  function runTranslate(text: string) {
    const trimmed = text.trim()
    if (trimmed.length < 2) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setTranslating(true)
    setError(null)
    chat({
      apiKey: settings.apiKey,
      model: settings.model,
      fallbackModel: settings.fallbackModel,
      messages: buildTranslatePrompt(trimmed, settings.from, settings.to),
      signal: ctrl.signal,
    })
      .then((result) => {
        if (ctrl.signal.aborted) return
        setOutput(result.content)
        addHistory({
          source: trimmed,
          target: result.content,
          from: settings.from,
          to: settings.to,
          model: result.model,
        })
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setTranslating(false)
      })
  }

  function stopTranslate() {
    abortRef.current?.abort()
    setTranslating(false)
    setRefining(false)
  }

  // Auto translate (when enabled): fires after 1.5s of typing inactivity.
  useEffect(() => {
    if (!settings.autoTranslate) return
    const text = debounced.trim()
    if (text.length < 2) {
      setOutput("")
      setError(null)
      return
    }
    runTranslate(debounced)
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debounced,
    settings.autoTranslate,
    settings.apiKey,
    settings.model,
    settings.from,
    settings.to,
  ])

  // Clear stale output when user wipes input (manual mode too).
  useEffect(() => {
    if (input.trim().length < 2) {
      setOutput("")
      setError(null)
      abortRef.current?.abort()
    }
  }, [input])

  function forceTranslate() {
    runTranslate(input)
  }

  function swap() {
    if (settings.from === "auto") return
    update({ from: settings.to, to: settings.from })
    setInput(output)
    setOutput(input)
  }

  async function handleCopy() {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  async function refine(instruction: string) {
    if (!output || !input.trim()) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setRefining(true)
    setError(null)
    try {
      const result = await chat({
        apiKey: settings.apiKey,
        model: settings.model,
        fallbackModel: settings.fallbackModel,
        messages: buildRefinePrompt(input, output, settings.to, instruction),
        signal: ctrl.signal,
      })
      if (ctrl.signal.aborted) return
      setOutput(result.content)
      addHistory({
        source: input.trim(),
        target: result.content,
        from: settings.from,
        to: settings.to,
        model: result.model,
      })
    } catch (e) {
      if (ctrl.signal.aborted) return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (!ctrl.signal.aborted) setRefining(false)
    }
  }

  function restoreHistory(e: HistoryEntry) {
    abortRef.current?.abort()
    setInput(e.source)
    setOutput(e.target)
    setError(null)
    update({ from: e.from, to: e.to })
  }

  function handleFreeRefine() {
    const t = refineText.trim()
    if (!t) return
    refine(t)
    setRefineText("")
  }

  const targetLang =
    LANGS.find((l) => l.code === settings.to)?.label ?? settings.to

  return (
    <div className="flex h-full flex-col">
      {/* Header — slim language bar */}
      <div
        className="flex items-center gap-1 border-b bg-muted/30 px-2 py-1.5"
        data-tauri-drag-region
      >
        <LangSelect
          value={settings.from}
          onChange={(v) => update({ from: v })}
          showAuto
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={swap}
          disabled={settings.from === "auto"}
          aria-label="언어 스왑"
        >
          <ArrowLeftRight className="h-3 w-3" />
        </Button>
        <LangSelect
          value={settings.to}
          onChange={(v) => update({ to: v })}
        />
        <div className="ml-auto flex items-center">
          <HistoryMenu
            entries={historyEntries}
            onRestore={restoreHistory}
            onRemove={removeHistory}
            onClear={clearHistory}
          />
          <SettingsMenu
            settings={settings}
            update={update}
            onLogout={onLogout}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            models={models}
            modelsLoading={modelsLoading}
          />
        </div>
      </div>

      {/* Input section */}
      <div className="px-3 pt-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              forceTranslate()
            }
          }}
          placeholder={
            settings.autoTranslate
              ? "번역할 텍스트를 입력하세요"
              : "텍스트 입력 후 ⌘⏎ 또는 번역 버튼"
          }
          autoFocus
          className="min-h-[140px] resize-none rounded-none border-0 bg-transparent p-0 text-[14px] leading-relaxed shadow-none transition-none placeholder:text-muted-foreground/70 focus-visible:border-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline-none dark:bg-transparent"
        />
      </div>

      {/* Divider with language label + stop button while translating */}
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-1">
        <Separator className="flex-1" />
        {translating || refining ? (
          <button
            type="button"
            onClick={stopTranslate}
            className="group inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:border-destructive/60 hover:text-destructive"
            aria-label="정지"
          >
            <Loader2 className="h-2.5 w-2.5 animate-spin group-hover:hidden" />
            <X className="hidden h-2.5 w-2.5 group-hover:inline" />
            <span>{targetLang}</span>
            <span className="hidden text-destructive group-hover:inline">정지</span>
          </button>
        ) : (
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {targetLang}
          </span>
        )}
        <Separator className="flex-1" />
      </div>

      {/* Output section */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div
          className="min-h-[120px] whitespace-pre-wrap text-[14px] leading-relaxed"
          aria-live="polite"
        >
          {output ? (
            output
          ) : translating ? (
            <span className="text-muted-foreground">번역 중...</span>
          ) : input.trim().length < 2 ? (
            <span className="text-muted-foreground">
              {settings.autoTranslate
                ? "타이핑하면 자동으로 번역돼요"
                : "텍스트 입력 후 ⌘⏎ 또는 아래 번역 버튼"}
            </span>
          ) : !settings.autoTranslate ? (
            <span className="text-muted-foreground">
              ⌘⏎ 또는 번역 버튼을 누르세요
            </span>
          ) : null}
        </div>
      </div>

      {/* Action bar */}
      <div className="border-t bg-muted/20 px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-1">
          {!settings.autoTranslate && (
            <Button
              size="sm"
              variant="default"
              className="h-7 rounded-full px-3 text-[11px]"
              onClick={forceTranslate}
              disabled={input.trim().length < 2 || translating}
            >
              {translating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CornerDownLeft className="h-3 w-3" />
              )}
              번역
            </Button>
          )}
          {REFINE_PRESETS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant="ghost"
              className="h-6 rounded-full px-2.5 text-[11px] hover:bg-background"
              disabled={!output || refining}
              onClick={() => refine(p.instruction)}
            >
              {p.label}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-0.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={!output || refining}
                  aria-label="직접 지시"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-72 p-2.5"
                sideOffset={6}
              >
                <Label className="text-[11px]">직접 지시</Label>
                <Textarea
                  value={refineText}
                  onChange={(e) => setRefineText(e.target.value)}
                  placeholder="예: 좀 더 다정한 어조로"
                  className="mt-1.5 min-h-[60px] text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      handleFreeRefine()
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="mt-2 w-full text-xs"
                  onClick={handleFreeRefine}
                  disabled={!refineText.trim() || refining}
                >
                  {refining ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "적용"
                  )}
                </Button>
              </PopoverContent>
            </Popover>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handleCopy}
              disabled={!output}
              aria-label="복사"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-1.5 border-t bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive">
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            aria-label="닫기"
            className="shrink-0 hover:opacity-80"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

function LangSelect({
  value,
  onChange,
  showAuto,
}: {
  value: LangCode
  onChange: (v: LangCode) => void
  showAuto?: boolean
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as LangCode)}>
      <SelectTrigger
        size="sm"
        className="h-7 w-[100px] border-none bg-transparent text-xs hover:bg-background data-[state=open]:bg-background"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGS.filter((l) => showAuto || l.code !== "auto").map((l) => (
          <SelectItem key={l.code} value={l.code} className="text-xs">
            {l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const THEME_OPTIONS = [
  { value: "system", icon: Monitor, label: "시스템" },
  { value: "light", icon: Sun, label: "라이트" },
  { value: "dark", icon: Moon, label: "다크" },
] as const

function SettingsMenu({
  settings,
  update,
  onLogout,
  themeMode,
  setThemeMode,
  models,
  modelsLoading,
}: {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  onLogout: () => void
  themeMode: ThemeMode
  setThemeMode: (m: ThemeMode) => void
  models: import("@/lib/openrouter").OpenRouterModel[]
  modelsLoading: boolean
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="설정"
        >
          <SettingsIcon className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-80 p-3">
        <div className="space-y-3">
          <div>
            <Label className="text-[11px]">번역 모드</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-1">
              <Button
                size="sm"
                variant={settings.autoTranslate ? "secondary" : "ghost"}
                className="h-8 text-[11px]"
                onClick={() => update({ autoTranslate: true })}
              >
                <Zap className="h-3 w-3" />
                자동 (1.5s)
              </Button>
              <Button
                size="sm"
                variant={!settings.autoTranslate ? "secondary" : "ghost"}
                className="h-8 text-[11px]"
                onClick={() => update({ autoTranslate: false })}
              >
                <ZapOff className="h-3 w-3" />
                수동 (⌘⏎)
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {settings.autoTranslate
                ? "타이핑이 멈추면 1.5초 후 자동 호출"
                : "⌘⏎ 또는 번역 버튼 누를 때만 호출 — 비용 절약"}
            </p>
          </div>

          <Separator />

          <div>
            <Label className="text-[11px]">기본 모델</Label>
            <div className="mt-1.5">
              <ModelPicker
                value={settings.model}
                onChange={(id) => update({ model: id })}
                models={models}
                loading={modelsLoading}
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {models.length > 0
                ? `${models.length}개 모델 사용 가능 · OpenRouter`
                : "API 키로 모델 목록을 불러오는 중..."}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-[11px]">폴백 모델 (선택)</Label>
              {settings.fallbackModel && (
                <button
                  type="button"
                  onClick={() => update({ fallbackModel: "" })}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  지우기
                </button>
              )}
            </div>
            <div className="mt-1.5">
              <ModelPicker
                value={settings.fallbackModel}
                onChange={(id) => update({ fallbackModel: id })}
                models={models}
                loading={modelsLoading}
                placeholder="폴백 없음"
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              기본 모델 실패(rate limit / 다운) 시 OpenRouter가 자동으로 이 모델로 재시도
            </p>
          </div>

          <Separator />

          <div>
            <Label className="text-[11px]">테마</Label>
            <div className="mt-1.5 grid grid-cols-3 gap-1">
              {THEME_OPTIONS.map((t) => {
                const Icon = t.icon
                const active = themeMode === t.value
                return (
                  <Button
                    key={t.value}
                    size="sm"
                    variant={active ? "secondary" : "ghost"}
                    className="h-8 text-[11px]"
                    onClick={() => setThemeMode(t.value)}
                  >
                    <Icon className="h-3 w-3" />
                    {t.label}
                  </Button>
                )
              })}
            </div>
          </div>

          <Separator />

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onLogout}
          >
            <LogOut className="h-3.5 w-3.5" />
            로그아웃 (키 삭제)
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
