import { useState } from "react"
import { Languages as TranslateIcon, MessageSquare } from "lucide-react"
import { TranslatePanel } from "./TranslatePanel"
import { ChatPanel } from "./ChatPanel"
import type { Settings } from "@/hooks/useSettings"
import type { ThemeMode } from "@/hooks/useTheme"
import { useT } from "@/i18n"
import { storage } from "@/lib/storage"
import { cn } from "@/lib/utils"

type Tab = "translate" | "chat"
const TAB_KEY = "active-tab"

type Props = {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  onLogout: () => void
  themeMode: ThemeMode
  setThemeMode: (m: ThemeMode) => void
}

export function TabbedPanel(props: Props) {
  const { t } = useT(props.settings.uiLocale)
  const [tab, setTab] = useState<Tab>(
    () => (storage.get<Tab>(TAB_KEY) ?? "translate") as Tab,
  )

  function selectTab(next: Tab) {
    setTab(next)
    storage.set(TAB_KEY, next)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tab strip */}
      <div
        className="flex shrink-0 items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1"
        data-tauri-drag-region
      >
        <TabButton
          active={tab === "translate"}
          icon={TranslateIcon}
          label={t("tab.translate")}
          onClick={() => selectTab("translate")}
        />
        <TabButton
          active={tab === "chat"}
          icon={MessageSquare}
          label={t("tab.chat")}
          onClick={() => selectTab("chat")}
        />
      </div>

      {/* Active panel */}
      <div className="flex-1 overflow-hidden">
        {tab === "translate" ? (
          <TranslatePanel {...props} />
        ) : (
          <ChatPanel settings={props.settings} update={props.update} />
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof MessageSquare
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
