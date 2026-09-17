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

interface LanguageComboboxProps<T extends string> {
  // `NoInfer` so `items` alone decides `T`. Inferring from `value` instead would
  // narrow `T` to whatever a caller's state happens to be typed as — a page
  // holding a `LangCodeISO6393` would lose `"auto"` from its own handler, and
  // its guard against it would become a dead comparison.
  value: NoInfer<T>
  onValueChange: (value: NoInfer<T>) => void
  /**
   * The rows to offer. Omit for the languages plus `auto`, which is what every
   * surface beside a page wants; pass your own to offer a different pinned row —
   * `getGlossaryTargetLanguageItems` is the one caller doing that today.
   */
  items?: LanguageItem<T>[]
  detectedLangCode?: LangCodeISO6393
  /** Offers auto under a fixed name, for callers with no page to detect a language from. */
  autoLabel?: string
  placeholder?: string
  /** The trigger's size, as a `Button` variant — `sm` matches the settings selects. */
  triggerSize?: ComponentProps<typeof Button>["size"]
  className?: string
}

export function LanguageCombobox<T extends string = LangCodeISO6393 | "auto">({
  value,
  onValueChange,
  items,
  detectedLangCode,
  autoLabel,
  placeholder,
  triggerSize,
  className,
}: LanguageComboboxProps<T>) {
  const languageItems = useMemo(() => {
    if (items) return items
    // The rows built here are `LangCodeISO6393 | "auto"`, which is exactly the
    // default `T`. A caller whose values are anything else — the glossary's
    // `all` — has to pass `items`, because there are no rows this branch could
    // build for it.
    return getLanguageItems(detectedLangCode, autoLabel) as LanguageItem<T>[]
  }, [items, detectedLangCode, autoLabel])

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
          {(item: LanguageItem<T> | null) => (
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
          {(item: LanguageItem<T>) => (
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
