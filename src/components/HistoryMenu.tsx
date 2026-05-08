import { History as HistoryIcon, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { timeAgo, type HistoryEntry } from "@/lib/history"

type Props = {
  entries: HistoryEntry[]
  onRestore: (e: HistoryEntry) => void
  onRemove: (id: string) => void
  onClear: () => void
}

export function HistoryMenu({ entries, onRestore, onRemove, onClear }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="번역 기록"
        >
          <HistoryIcon className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[360px] p-0"
      >
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-medium">최근 번역</span>
          {entries.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
              onClick={onClear}
            >
              <Trash2 className="h-3 w-3" />
              전체 삭제
            </Button>
          )}
        </div>
        <Separator />
        <div className="max-h-[360px] overflow-y-auto">
          {entries.length === 0 ? (
            <div className="px-3 py-8 text-center text-[11px] text-muted-foreground">
              아직 번역 기록이 없어요
            </div>
          ) : (
            entries.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onRestore(e)}
                className="group relative flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left text-xs hover:bg-accent/40 last:border-b-0"
              >
                <div className="line-clamp-1 text-foreground">
                  {e.source}
                </div>
                <div className="line-clamp-1 text-muted-foreground">
                  → {e.target}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>{timeAgo(e.ts)}</span>
                  <span>·</span>
                  <span className="truncate">{e.model}</span>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onRemove(e.id)
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.stopPropagation()
                      onRemove(e.id)
                    }
                  }}
                  className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover:opacity-100"
                  aria-label="삭제"
                >
                  <X className="h-3 w-3" />
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
