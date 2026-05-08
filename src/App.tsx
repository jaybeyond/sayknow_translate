import { useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { useSettings } from "./hooks/useSettings"
import { useTheme } from "./hooks/useTheme"
import { LoginPanel } from "./components/LoginPanel"
import { TranslatePanel } from "./components/TranslatePanel"

function App() {
  const { settings, update, clearKey, isLoggedIn, loaded } = useSettings()
  const { mode: themeMode, setMode: setThemeMode } = useTheme()
  const rootRef = useRef<HTMLDivElement>(null)

  // Replay enter animation each time the menubar window becomes visible.
  useEffect(() => {
    function play() {
      const el = rootRef.current
      if (!el) return
      el.classList.remove("appear")
      // Force reflow so the animation restarts.
      void el.offsetWidth
      el.classList.add("appear")
    }
    function reset() {
      // On blur the Tauri window is about to hide. Drop the appear class so
      // the next show() begins from the hidden start state, not the end state.
      rootRef.current?.classList.remove("appear")
    }
    play()
    window.addEventListener("focus", play)
    window.addEventListener("blur", reset)
    return () => {
      window.removeEventListener("focus", play)
      window.removeEventListener("blur", reset)
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className="popover-root appear h-svh w-svw overflow-hidden rounded-xl border border-border/50 bg-background/85 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:bg-background/85 dark:ring-white/10"
    >
      {!loaded ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : isLoggedIn ? (
        <TranslatePanel
          settings={settings}
          update={update}
          onLogout={clearKey}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
        />
      ) : (
        <LoginPanel update={update} />
      )}
    </div>
  )
}

export default App
