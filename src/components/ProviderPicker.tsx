import { useEffect, useRef, useState } from "react"
import { Check, ExternalLink, Loader2, Play, Power, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  PROVIDER_PRESETS,
  type ProviderId,
} from "@/lib/openrouter"
import { useT, type UILocaleSetting } from "@/i18n"
import { useProviderProbe, type ProbeStatus } from "@/hooks/useProviderProbe"
import {
  useOcpDaemon,
  type OcpAction,
  type OcpEnv,
} from "@/hooks/useOcpDaemon"
import { openExternal } from "@/lib/runtime"
import { cn } from "@/lib/utils"

type Props = {
  provider: ProviderId
  baseURL: string
  apiKey?: string
  uiLocale: UILocaleSetting
  onChange: (next: { provider: ProviderId; baseURL: string }) => void
  /** Called once when the selected provider becomes reachable without auth.
   * The parent can use this for one-tap login (OCP open mode). */
  onAutoReachable?: () => void
  compact?: boolean
}

const PROVIDER_ORDER: ProviderId[] = ["openrouter", "ocp", "custom"]

export function ProviderPicker({
  provider,
  baseURL,
  apiKey = "",
  uiLocale,
  onChange,
  onAutoReachable,
  compact,
}: Props) {
  const { t } = useT(uiLocale)

  function pick(id: ProviderId) {
    const preset = PROVIDER_PRESETS[id]
    onChange({
      provider: id,
      baseURL: id === provider ? baseURL : preset.baseURL,
    })
  }

  // OCP lifecycle (install + spawn). Only active while OCP card is selected.
  const ocp = useOcpDaemon(provider === "ocp")

  // For OCP we trust the daemon's TCP port check as the single source of
  // truth. OCP's HTTP `/v1/models` can transiently 401/timeout right after
  // launch, which would otherwise show a misleading "not running" badge
  // next to the green "running" panel.
  const ocpPortOpen = provider === "ocp" && ocp.env.running

  // Probe only providers that are "self-detectable". Skip the HTTP probe
  // for OCP whenever the TCP check already says it's up.
  const shouldProbe =
    !ocpPortOpen &&
    (provider === "ocp" || provider === "custom") &&
    baseURL.length > 0
  const httpStatus = useProviderProbe(baseURL, apiKey, shouldProbe)
  const status: ProbeStatus = ocpPortOpen ? "ready" : httpStatus

  // Fire onAutoReachable once per ready edge so the parent can auto-login.
  const lastFiredFor = useRef<string>("")
  useEffect(() => {
    if (status !== "ready") return
    const sig = `${provider}|${baseURL}`
    if (lastFiredFor.current === sig) return
    lastFiredFor.current = sig
    onAutoReachable?.()
  }, [status, provider, baseURL, onAutoReachable])

  return (
    <div className="space-y-2">
      <Label className="text-[11px]">{t("provider.label")}</Label>
      <div className={cn("grid gap-1.5", compact ? "grid-cols-1" : "grid-cols-1")}>
        {PROVIDER_ORDER.map((id) => {
          const active = provider === id
          const showStatus = active && (id === "ocp" || id === "custom")
          return (
            <button
              key={id}
              type="button"
              onClick={() => pick(id)}
              className={cn(
                "flex items-start gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition",
                active
                  ? "border-foreground/60 bg-accent/40"
                  : "border-border hover:border-border/80 hover:bg-accent/20",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border",
                )}
              >
                {active && <Check className="h-2.5 w-2.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="text-[12px] font-medium leading-tight">
                    {t(`provider.preset.${id}`)}
                  </div>
                  {showStatus && (
                    <StatusBadge status={status} uiLocale={uiLocale} />
                  )}
                </div>
                <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                  {t(`provider.${id}.body`)}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div>
        <Label className="text-[10px] text-muted-foreground">
          {t("provider.baseURL")}
        </Label>
        <Input
          value={baseURL}
          onChange={(e) =>
            onChange({ provider, baseURL: e.target.value })
          }
          readOnly={provider !== "custom"}
          placeholder={
            provider === "ocp"
              ? "http://localhost:3456/v1"
              : provider === "openrouter"
                ? "https://openrouter.ai/api/v1"
                : "https://your-endpoint/v1"
          }
          className={cn(
            "mt-1 h-8 text-[11px] font-mono",
            provider !== "custom" && "text-muted-foreground",
          )}
        />
      </div>
      {provider === "ocp" && (
        <OcpControlPanel
          uiLocale={uiLocale}
          env={ocp.env}
          action={ocp.action}
          error={ocp.error}
          logs={ocp.logs}
          startedAt={ocp.startedAt}
          onInstall={ocp.install}
          onStart={ocp.start}
          onStop={ocp.stop}
          onEnsureRunning={ocp.ensureRunning}
          dismissError={() => ocp.setError(null)}
        />
      )}
    </div>
  )
}

function StatusBadge({
  status,
  uiLocale,
}: {
  status: ProbeStatus
  uiLocale: UILocaleSetting
}) {
  const { t } = useT(uiLocale)
  if (status === "idle") return null
  const map: Record<
    Exclude<ProbeStatus, "idle">,
    { label: string; color: string }
  > = {
    checking: {
      label: t("provider.status.checking"),
      color: "bg-muted-foreground/30 text-muted-foreground",
    },
    ready: {
      label: t("provider.status.ready"),
      color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    },
    "auth-required": {
      label: t("provider.status.authRequired"),
      color: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    },
    down: {
      label: t("provider.status.down"),
      color: "bg-destructive/15 text-destructive",
    },
  }
  const v = map[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium",
        v.color,
      )}
    >
      {status === "checking" && <Loader2 className="h-2 w-2 animate-spin" />}
      {v.label}
    </span>
  )
}

function OcpControlPanel({
  uiLocale,
  env,
  action,
  error,
  logs,
  startedAt,
  onInstall,
  onStart,
  onStop,
  onEnsureRunning,
  dismissError,
}: {
  uiLocale: UILocaleSetting
  env: OcpEnv
  action: OcpAction
  error: string | null
  logs: string[]
  startedAt: number | null
  onInstall: () => Promise<void>
  onStart: () => Promise<void>
  onStop: () => Promise<void>
  onEnsureRunning: () => Promise<void>
  dismissError: () => void
}) {
  const { t } = useT(uiLocale)

  // Prereq missing — npm or claude. We can't auto-install Node, only guide.
  const missingClaude = !env.claudePath
  const missingNpm = !env.npmPath

  if (missingClaude || missingNpm) {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px]">
        <div className="font-medium">{t("ocp.prereq.title")}</div>
        <ul className="mt-1.5 space-y-1 text-[10px] text-muted-foreground">
          {missingNpm && (
            <li className="flex items-center justify-between gap-2">
              <span>• {t("ocp.prereq.node")}</span>
              <button
                type="button"
                onClick={() => openExternal("https://nodejs.org/")}
                className="inline-flex items-center gap-1 text-foreground hover:opacity-80"
              >
                nodejs.org <ExternalLink className="h-2 w-2" />
              </button>
            </li>
          )}
          {missingClaude && (
            <li className="flex items-center justify-between gap-2">
              <span>• {t("ocp.prereq.claude")}</span>
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                npm i -g @anthropic-ai/claude-code
              </code>
            </li>
          )}
        </ul>
      </div>
    )
  }

  if (env.running) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5 text-[11px]">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-emerald-700 dark:text-emerald-400">
            {t("ocp.state.running")}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
          onClick={onStop}
          disabled={action !== "idle"}
        >
          <Power className="h-3 w-3" />
          {t("ocp.action.stop")}
        </Button>
      </div>
    )
  }

  // Not running. Single "Start OCP" button — start_ocp auto-falls-back to
  // `npx -y ocp` if no global install, so the user doesn't need to deal with
  // permission-prone `npm install -g`.
  const busy = action !== "idle"
  const needsDownload = !env.ocpPath
  const label = busy
    ? needsDownload
      ? t("ocp.action.installing")
      : t("ocp.action.starting")
    : needsDownload
      ? t("ocp.action.startWithDownload")
      : t("ocp.action.start")

  return (
    <div className="space-y-2">
      <Button
        size="sm"
        className="w-full text-[12px]"
        onClick={onEnsureRunning}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : needsDownload ? (
          <Wrench className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        {label}
      </Button>
      {busy && (
        <OcpProgressCard logs={logs} startedAt={startedAt} label={label} />
      )}
      {!busy && needsDownload && (
        <p className="text-[10px] text-muted-foreground">
          {t("ocp.action.downloadHint")}
        </p>
      )}
      {!busy && !needsDownload && (
        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span className="truncate font-mono">{env.ocpPath}</span>
          <button
            type="button"
            onClick={onInstall}
            disabled={busy}
            className="shrink-0 hover:text-foreground disabled:opacity-50"
          >
            {t("ocp.action.reinstall")}
          </button>
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[10px] text-destructive">
          <div className="flex items-start gap-1.5">
            <span className="flex-1 break-words font-medium">{error}</span>
            <button
              type="button"
              onClick={dismissError}
              className="shrink-0 hover:opacity-80"
            >
              ×
            </button>
          </div>
          {logs.length > 0 && (
            <pre className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap break-all rounded bg-background/40 p-1.5 font-mono text-[9px] leading-tight text-destructive/80">
              {logs.slice(-30).join("\n")}
            </pre>
          )}
        </div>
      )}
      {/* Silence unused-import warnings. */}
      <span className="hidden">
        {onStart.toString().length}
      </span>
    </div>
  )
}

function OcpProgressCard({
  logs,
  startedAt,
  label,
}: {
  logs: string[]
  startedAt: number | null
  label: string
}) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startedAt) return
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [startedAt])

  const recent = logs.slice(-8)
  const lastLine = logs[logs.length - 1] ?? ""

  return (
    <div className="rounded-md border bg-muted/30 p-2.5 text-[10px]">
      <div className="flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-foreground">{label}</span>
        <span className="ml-auto tabular-nums text-muted-foreground">
          {elapsed}s
        </span>
      </div>
      {lastLine && (
        <div className="mt-1.5 truncate font-mono text-muted-foreground">
          {lastLine}
        </div>
      )}
      {recent.length > 1 && (
        <pre className="mt-1.5 max-h-32 overflow-y-auto whitespace-pre-wrap break-all rounded bg-background/40 p-1.5 font-mono text-[9px] leading-tight text-muted-foreground">
          {recent.join("\n")}
        </pre>
      )}
    </div>
  )
}
