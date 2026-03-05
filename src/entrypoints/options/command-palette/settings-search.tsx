import { i18n } from "#imports"
import { useAtom } from "jotai"
import { useEffect, useMemo } from "react"
import { useLocation, useNavigate } from "react-router"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/base-ui/command"
import { commandPaletteOpenAtom } from "./atoms"
import { SEARCH_ITEMS } from "./search-items"

export function SettingsSearch() {
  const [open, setOpen] = useAtom(commandPaletteOpenAtom)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [setOpen])

  const groupedItems = useMemo(() => {
    const groups = new Map<(typeof SEARCH_ITEMS)[number]["pageKey"], typeof SEARCH_ITEMS>()
    for (const item of SEARCH_ITEMS) {
      const existing = groups.get(item.pageKey)
      if (existing) {
        existing.push(item)
      }
      else {
        groups.set(item.pageKey, [item])
      }
    }
    return groups
  }, [])

  function handleSelect(item: (typeof SEARCH_ITEMS)[number]) {
    setOpen(false)
    if (pathname === item.route) {
      scrollToSection(item.sectionId)
    }
    else {
      void navigate(item.route)
      setTimeout(() => scrollToSection(item.sectionId), 100)
    }
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={i18n.t("options.commandPalette.placeholder")}
      description={i18n.t("options.commandPalette.placeholder")}
    >
      <Command>
        <CommandInput placeholder={i18n.t("options.commandPalette.placeholder")} />
        <CommandList>
          <CommandEmpty>{i18n.t("options.commandPalette.noResults")}</CommandEmpty>
          {Array.from(groupedItems.entries()).map(([pageKey, items]) => (
            <CommandGroup key={pageKey} heading={i18n.t(pageKey)}>
              {items.map(item => (
                <CommandItem
                  key={item.sectionId}
                  value={buildSearchValue(item)}
                  onSelect={() => handleSelect(item)}
                >
                  <span>{i18n.t(item.titleKey)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

function buildSearchValue(item: (typeof SEARCH_ITEMS)[number]): string {
  const parts = [i18n.t(item.titleKey)]
  if (item.descriptionKey) {
    parts.push(i18n.t(item.descriptionKey))
  }
  return parts.join(" ")
}

function scrollToSection(sectionId: string) {
  const el = document.getElementById(sectionId)
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" })
  }
}
