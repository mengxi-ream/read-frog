import { Kbd, KbdGroup } from "@/components/ui/base-ui/kbd"
import { formatHotkeyParts } from "@/utils/os"
import { isPageTranslationShortcutEmpty } from "@/utils/page-translation-shortcut"

// A toolbar button's tooltip: its name, then its keys as key caps when it has
// a key.
export function ShortcutTooltipLabel({
  label,
  shortcut,
}: {
  label: string
  shortcut: string | undefined
}) {
  if (isPageTranslationShortcutEmpty(shortcut)) {
    return label
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span>{label}</span>
      <KbdGroup>
        {formatHotkeyParts(shortcut!).map((part) => (
          <Kbd key={part}>{part}</Kbd>
        ))}
      </KbdGroup>
    </span>
  )
}
