import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { ComponentProps } from "react"
import type { LanguageItem } from "./language-combobox-options"
import { useMemo } from "react"
import { Button } from "@/components/ui/base-ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/base-ui/combobox"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { filterLanguage, getLanguageItems } from "./language-combobox-options"

function AutoBadge() {
  return <span className="rounded-full bg-neutral-200 px-1 text-xs dark:bg-neutral-800">auto</span>
}

interface LanguageComboboxProps {
  value: LangCodeISO6393 | "auto"
  onValueChange: (value: LangCodeISO6393 | "auto") => void
  detectedLangCode?: LangCodeISO6393
  /** Offers auto under a fixed name, for callers with no page to detect a language from. */
  autoLabel?: string
  placeholder?: string
  /** The trigger's size, as a `Button` variant — `sm` matches the settings selects. */
  triggerSize?: ComponentProps<typeof Button>["size"]
  className?: string
}

export function LanguageCombobox({
  value,
  onValueChange,
  detectedLangCode,
  autoLabel,
  placeholder,
  triggerSize,
  className,
}: LanguageComboboxProps) {
  const languageItems = useMemo(
    () => getLanguageItems(detectedLangCode, autoLabel),
    [detectedLangCode, autoLabel],
  )

  return (
    <Combobox
      value={languageItems.find((item) => item.value === value) ?? null}
      onValueChange={(item) => {
        if (item) onValueChange(item.value)
      }}
      items={languageItems}
      filter={filterLanguage}
      autoHighlight
    >
      <ComboboxTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={triggerSize}
            className={cn("w-auto min-w-0 justify-between font-normal", className)}
          />
        }
      >
        {/* `ComboboxValue` renders no element of its own, so both children below land
            directly in the trigger's flex row. */}
        <ComboboxValue placeholder={placeholder ?? i18n.t("translationHub.searchLanguages")}>
          {(item: LanguageItem | null) => (
            <>
              <span className="min-w-0 flex-1 truncate text-left">
                {item?.label ?? placeholder ?? i18n.t("translationHub.searchLanguages")}
              </span>
              {/* The auto row is named after a real language, so without the badge the
                  trigger reads exactly like that language pinned by hand. */}
              {item?.value === "auto" && !autoLabel && <AutoBadge />}
            </>
          )}
        </ComboboxValue>
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInput
          showTrigger={false}
          placeholder={placeholder ?? i18n.t("translationHub.searchLanguages")}
        />
        <ComboboxList>
          {(item: LanguageItem) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
              {/* The badge is what marks a language name as the auto row; an `autoLabel`
                  already says so in words, so it would only repeat itself. */}
              {item.value === "auto" && !autoLabel && <AutoBadge />}
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxEmpty>{i18n.t("translationHub.noLanguagesFound")}</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  )
}
