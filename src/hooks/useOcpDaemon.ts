import { useCallback, useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { isTauri } from "@/lib/runtime"

export type OcpEnv = {
  ocpPath: string | null
  npmPath: string | null
  claudePath: string | null
  running: boolean
}

export type OcpAction = "idle" | "installing" | "starting" | "stopping"

type RawEnv = {
  ocp_path: string | null
  npm_path: string | null
  claude_path: string | null
  running: boolean
}

function normalize(raw: RawEnv): OcpEnv {
  return {
    ocpPath: raw.ocp_path,
    npmPath: raw.npm_path,
    claudePath: raw.claude_path,
    running: raw.running,
  }
}

export function useOcpDaemon(active: boolean) {
  const [env, setEnv] = useState<OcpEnv>({
    ocpPath: null,
    npmPath: null,
    claudePath: null,
    running: false,
  })
  const [action, setAction] = useState<OcpAction>("idle")
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const startedAtRef = useRef<number | null>(null)
  startedAtRef.current = startedAt

  const refresh = useCallback(async () => {
    if (!isTauri()) return
    try {
      const raw = await invoke<RawEnv>("detect_ocp_env")
      setEnv(normalize(raw))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  // Initial + periodic poll while the OCP card is active.
  useEffect(() => {
    if (!active || !isTauri()) return
    void refresh()
    const id = window.setInterval(refresh, 2500)
    return () => window.clearInterval(id)
  }, [active, refresh])

  // Subscribe to streaming logs and status events from start_ocp.
  useEffect(() => {
    if (!isTauri()) return
    let unlistenLog: (() => void) | null = null
    let unlistenStatus: (() => void) | null = null
    void listen<string>("ocp:log", (e) => {
      setLogs((prev) => {
        const next = [...prev, e.payload]
        return next.length > 200 ? next.slice(-200) : next
      })
    }).then((fn) => {
      unlistenLog = fn
    })
    void listen<string>("ocp:status", () => {
      // Just trigger a refresh so the UI picks up the running flag fast.
      void refresh()
    }).then((fn) => {
      unlistenStatus = fn
    })
    return () => {
      unlistenLog?.()
      unlistenStatus?.()
    }
  }, [refresh])

  const install = useCallback(async () => {
    if (!isTauri()) return
    setAction("installing")
    setError(null)
    try {
      await invoke("install_ocp")
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAction("idle")
    }
  }, [refresh])

  const start = useCallback(async () => {
    if (!isTauri()) return
    setAction("starting")
    setError(null)
    setLogs([])
    setStartedAt(Date.now())
    try {
      await invoke("start_ocp")
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAction("idle")
      setStartedAt(null)
    }
  }, [refresh])

  const stop = useCallback(async () => {
    if (!isTauri()) return
    setAction("stopping")
    try {
      await invoke("stop_ocp")
      await refresh()
    } finally {
      setAction("idle")
    }
  }, [refresh])

  /** Top-level convenience: get OCP running.
   *  Relies on start_ocp's `npx -y ocp` fallback, so we don't need a separate
   *  install step. Install is still exposed for explicit reinstall. */
  const ensureRunning = useCallback(async () => {
    if (!isTauri()) return
    if (env.running) return
    await start()
  }, [env.running, start])

  return {
    env,
    action,
    error,
    setError,
    refresh,
    install,
    start,
    stop,
    ensureRunning,
    logs,
    startedAt,
  }
}
