import type { LangCodeISO6393 } from "@read-frog/definitions"
import { Icon } from "@iconify/react"
import { Button } from "@/components/ui/base-ui/button"
import { getLanguageLabel } from "@/utils/language-labels"
import { cn } from "@/utils/styles/utils"

/**
 * The languages already picked, each removable. Rendered under a `ConfigItem` description
 * rather than beside the combobox: the list is as long as the reader made it, and the control
 * column is the wrong half of the row to grow in.
 */
export function LanguageChips({
  languages,
  onRemove,
  className,
}: {
  languages: LangCodeISO6393[]
  onRemove: (language: LangCodeISO6393) => void
  className?: string
}) {
  if (languages.length === 0) {
    return null
  }

  return (
    <span className={cn("mt-2 flex flex-wrap gap-1.5", className)}>
      {languages.map((language) => (
        <span
          key={language}
          className="inline-flex items-center gap-0.5 rounded-md border bg-muted py-0.5 pr-0.5 pl-1.5 text-xs text-foreground"
        >
          {getLanguageLabel(language)}
          <Button
            variant="ghost"
            size="icon-xs"
            className="hover:text-input-foreground size-4 hover:bg-input"
            onClick={() => onRemove(language)}
          >
            <Icon icon="tabler:x" className="size-3" />
          </Button>
        </span>
      ))}
    </span>
  )
}
