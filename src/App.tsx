import { useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { useSettings } from "./hooks/useSettings"
import { useTheme } from "./hooks/useTheme"
import { LoginPanel } from "./components/LoginPanel"
import { TabbedPanel } from "./components/TabbedPanel"
import { SettingsWindow } from "./components/SettingsWindow"

function isSettingsWindow(): boolean {
  if (typeof window === "undefined") return false
  return new URLSearchParams(window.location.search).get("window") === "settings"
}

function App() {
  if (isSettingsWindow()) return <SettingsRoot />
  return <MainRoot />
}

function MainRoot() {
  const { settings, update, clearKey, isLoggedIn, loaded } = useSettings()
  const { mode: themeMode, setMode: setThemeMode } = useTheme()
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function play() {
      const el = contentRef.current
      if (!el) return
      el.classList.remove("appear")
      void el.offsetWidth
      el.classList.add("appear")
    }
    function reset() {
      contentRef.current?.classList.remove("appear")
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
    // Outer shell — always rendered with full bg/border/shadow/blur so the
    // popover skin never disappears. Animation lives on the inner content layer.
    <div className="h-svh w-svw overflow-hidden rounded-xl border border-border/50 bg-background/85 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:bg-background/85 dark:ring-white/10">
      <div
        ref={contentRef}
        className="popover-content appear h-full w-full"
      >
        {!loaded ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : isLoggedIn ? (
          <TabbedPanel
            settings={settings}
            update={update}
            onLogout={clearKey}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
          />
        ) : (
          <LoginPanel update={update} uiLocale={settings.uiLocale} />
        )}
      </div>
    </div>
  )
}

function SettingsRoot() {
  const { settings, update, clearKey, loaded } = useSettings()
  const { mode: themeMode, setMode: setThemeMode } = useTheme()

  if (!loaded) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <SettingsWindow
      settings={settings}
      update={update}
      onLogout={clearKey}
      themeMode={themeMode}
      setThemeMode={setThemeMode}
    />
  )
}

export default App
