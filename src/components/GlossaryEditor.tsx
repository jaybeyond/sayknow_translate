import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { GlossaryTerm } from "@/hooks/useSettings"
import { useT, type UILocaleSetting } from "@/i18n"

type Props = {
  value: GlossaryTerm[]
  onChange: (next: GlossaryTerm[]) => void
  uiLocale: UILocaleSetting
}

export function GlossaryEditor({ value, onChange, uiLocale }: Props) {
  const { t } = useT(uiLocale)
  const [src, setSrc] = useState("")
  const [tgt, setTgt] = useState("")

  function add() {
    const s = src.trim()
    const t = tgt.trim()
    if (!s || !t) return
    if (value.some((g) => g.source.toLowerCase() === s.toLowerCase())) {
      // already exists; replace
      onChange(
        value.map((g) =>
          g.source.toLowerCase() === s.toLowerCase()
            ? { source: s, target: t }
            : g,
        ),
      )
    } else {
      onChange([...value, { source: s, target: t }])
    }
    setSrc("")
    setTgt("")
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <div className="space-y-0.5 rounded-md border bg-muted/30 p-1">
          {value.map((g, i) => (
            <div
              key={`${g.source}-${i}`}
              className="group flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] hover:bg-background"
            >
              <span className="truncate">{g.source}</span>
              <span className="text-muted-foreground">→</span>
              <span className="flex-1 truncate text-foreground">{g.target}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                aria-label={t("common.delete")}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1">
        <Input
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add()
          }}
          placeholder={t("settings.glossary.source")}
          className="h-7 text-[11px]"
        />
        <span className="text-[10px] text-muted-foreground">→</span>
        <Input
          value={tgt}
          onChange={(e) => setTgt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add()
          }}
          placeholder={t("settings.glossary.target")}
          className="h-7 text-[11px]"
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={add}
          disabled={!src.trim() || !tgt.trim()}
          className="h-7 w-7 shrink-0"
          aria-label={t("common.add")}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {t("settings.glossary.example")}
      </p>
    </div>
  )
}
