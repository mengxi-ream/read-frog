import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { LanguageItem } from "./language-combobox-options"
import { i18n } from "#imports"
import { useMemo } from "react"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/base-ui/combobox"
import { filterLanguage, getLanguageItems } from "./language-combobox-options"

function AutoBadge() {
  return <span className="rounded-full bg-neutral-200 px-1 text-xs dark:bg-neutral-800">auto</span>
}

interface LanguageComboboxProps {
  value: LangCodeISO6393 | "auto"
  onValueChange: (value: LangCodeISO6393 | "auto") => void
  detectedLangCode?: LangCodeISO6393
  placeholder?: string
  className?: string
}

export function LanguageCombobox({
  value,
  onValueChange,
  detectedLangCode,
  placeholder,
  className,
}: LanguageComboboxProps) {
  const languageItems = useMemo(
    () => getLanguageItems(detectedLangCode),
    [detectedLangCode],
  )

  return (
    <Combobox
      value={languageItems.find(item => item.value === value) ?? null}
      onValueChange={(item) => {
        if (item)
          onValueChange(item.value)
      }}
      items={languageItems}
      filter={filterLanguage}
      autoHighlight
    >
      <ComboboxInput
        className={className}
        placeholder={placeholder ?? i18n.t("translationHub.searchLanguages")}
      />
      <ComboboxContent className="w-fit">
        <ComboboxList>
          {(item: LanguageItem) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
              {item.value === "auto" && <AutoBadge />}
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxEmpty>{i18n.t("translationHub.noLanguagesFound")}</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  )
}
