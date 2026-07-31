import type { LangCodeISO6393 } from "@read-frog/definitions"
import { Icon } from "@iconify/react"
import { Button } from "@/components/ui/base-ui/button"
import { getLanguageLabel } from "@/utils/language-labels"

/**
 * The languages already picked, each removable. The combobox above only ever adds, so this is
 * where a language leaves the list — and the only place its name is spelled out.
 */
export function LanguageChips({
  languages,
  onRemove,
}: {
  languages: LangCodeISO6393[]
  onRemove: (language: LangCodeISO6393) => void
}) {
  if (languages.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {languages.map((language) => (
        <div
          key={language}
          className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-sm"
        >
          <span>{getLanguageLabel(language)}</span>
          <Button
            variant="ghost"
            size="icon"
            className="hover:text-input-foreground size-4 p-0 hover:bg-input"
            onClick={() => onRemove(language)}
          >
            <Icon icon="tabler:x" className="size-3" />
          </Button>
        </div>
      ))}
    </div>
  )
}
