import { useState } from "react"
import {
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Wand2,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { verifyKey } from "@/lib/openrouter"
import type { Settings } from "@/hooks/useSettings"

type Props = {
  update: (patch: Partial<Settings>) => void
}

const FEATURES = [
  {
    icon: Zap,
    title: "자동 번역",
    body: "타이핑이 멈추면 0.7초 후 자동으로.",
  },
  {
    icon: Wand2,
    title: "수정 번역",
    body: "정중히·캐주얼·짧게 + 자유 프롬프트.",
  },
  {
    icon: Globe,
    title: "OpenRouter BYOK",
    body: "키 하나로 GPT·Claude·Gemini 전부.",
  },
] as const

export function LoginPanel({ update }: Props) {
  const [key, setKey] = useState("")
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    if (!key.trim()) return
    setStatus("checking")
    setError(null)
    try {
      const ok = await verifyKey(key.trim())
      if (!ok) {
        setStatus("error")
        setError("키가 유효하지 않습니다.")
        return
      }
      update({ apiKey: key.trim() })
    } catch (e) {
      setStatus("error")
      setError(e instanceof Error ? e.message : "연결 실패")
    }
  }

  return (
    <div
      className="flex h-full flex-col px-5 pt-5 pb-4"
      data-tauri-drag-region
    >
      {/* Hero */}
      <div className="text-center" data-tauri-drag-region>
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background shadow-md">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="m5 8 6 6" />
            <path d="m4 14 6-6 2-3" />
            <path d="M2 5h12" />
            <path d="M7 2h1" />
            <path d="m22 22-5-10-5 10" />
            <path d="M14 18h6" />
          </svg>
        </div>
        <h1 className="mt-2 text-base font-semibold leading-tight">SayKnow</h1>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          타이핑하면 바로 번역되는 메뉴바 AI 번역기
        </p>
      </div>

      {/* Key form */}
      <div className="mt-4">
        <Label htmlFor="api-key" className="text-[11px]">
          OpenRouter API Key
        </Label>
        <div className="relative mt-1.5">
          <Input
            id="api-key"
            type={show ? "text" : "password"}
            placeholder="sk-or-..."
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConnect()
            }}
            className="pr-9 text-sm"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={show ? "키 숨기기" : "키 보이기"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <Button
          onClick={handleConnect}
          disabled={!key.trim() || status === "checking"}
          className="mt-2 w-full"
          size="sm"
        >
          {status === "checking" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              확인 중...
            </>
          ) : (
            "연결하고 시작"
          )}
        </Button>

        {error && (
          <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
            {error}
          </div>
        )}

        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex w-full items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          openrouter.ai/keys 에서 키 발급
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>

      {/* Feature showcase */}
      <div className="mt-auto grid grid-cols-3 gap-1.5 pt-4">
        {FEATURES.map((f) => {
          const Icon = f.icon
          return (
            <div
              key={f.title}
              className="rounded-lg border bg-muted/30 p-2.5 text-left"
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="mt-1.5 text-[11px] font-semibold leading-tight">
                {f.title}
              </div>
              <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                {f.body}
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-2.5 text-center text-[10px] text-muted-foreground">
        키는 macOS Keychain에 저장됩니다.
      </p>
    </div>
  )
}
