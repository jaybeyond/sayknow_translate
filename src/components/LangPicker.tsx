import { useState } from "react"
import { ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { LANGS, type LangCode } from "@/lib/openrouter"
import { useT, type UILocaleSetting } from "@/i18n"

type Props = {
  value: LangCode
  onChange: (code: LangCode) => void
  showAuto?: boolean
  uiLocale: UILocaleSetting
}

export function LangPicker({ value, onChange, showAuto, uiLocale }: Props) {
  const { t } = useT(uiLocale)
  const [open, setOpen] = useState(false)
  const items = LANGS.filter((l) => showAuto || l.code !== "auto")
  const current = items.find((l) => l.code === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="h-7 w-[110px] justify-between bg-transparent px-2 text-xs hover:bg-background data-[state=open]:bg-background"
        >
          <span className="truncate">{current?.label ?? value}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start" sideOffset={4}>
        <Command
          filter={(val, search, keywords) => {
            const haystack = (val + " " + (keywords?.join(" ") ?? "")).toLowerCase()
            return haystack.includes(search.toLowerCase()) ? 1 : 0
          }}
        >
          <CommandInput placeholder={t("lang.search")} className="text-xs" />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>{t("common.empty")}</CommandEmpty>
            <CommandGroup>
              {items.map((l) => (
                <CommandItem
                  key={l.code}
                  value={l.code}
                  keywords={[l.label, l.english, l.keywords]}
                  onSelect={() => {
                    onChange(l.code)
                    setOpen(false)
                  }}
                  className="flex items-center justify-between gap-2 py-1.5 text-xs"
                >
                  <span className="truncate">{l.label}</span>
                  {l.label !== l.english && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {l.english}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
