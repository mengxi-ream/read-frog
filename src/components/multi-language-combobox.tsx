import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { LanguageItem } from "./language-combobox-options"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { Icon } from "@iconify/react"
import { langCodeISO6393Schema } from "@read-frog/definitions"
import { useMemo } from "react"
import { Button } from "@/components/ui/base-ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/base-ui/combobox"
import { i18n } from "@/utils/i18n"
import { getLanguageLabel } from "@/utils/language-labels"
import { filterLanguage } from "./language-combobox-options"

function getLanguageItems(): LanguageItem<LangCodeISO6393>[] {
  return langCodeISO6393Schema.options.map(code => ({
    value: code,
    label: getLanguageLabel(code),
  }))
}

interface MultiLanguageComboboxProps {
  selectedLanguages: LangCodeISO6393[]
  onLanguagesChange: (languages: LangCodeISO6393[]) => void
  buttonLabel: string
}

export function MultiLanguageCombobox({
  selectedLanguages,
  onLanguagesChange,
  buttonLabel,
}: MultiLanguageComboboxProps) {
  const languageItems = useMemo(() => getLanguageItems(), [])

  const selectedItems = useMemo(
    () => languageItems.filter(item => selectedLanguages.includes(item.value)),
    [languageItems, selectedLanguages],
  )

  return (
    <Combobox
      multiple
      value={selectedItems}
      onValueChange={(items: LanguageItem<LangCodeISO6393>[]) => {
        onLanguagesChange(items.map(item => item.value))
      }}
      items={languageItems}
      filter={filterLanguage}
    >
      <ComboboxPrimitive.Trigger render={<Button variant="outline" className="w-40 justify-between" />}>
        <span className="truncate">{buttonLabel}</span>
        <Icon icon="tabler:chevron-down" className="text-muted-foreground" />
      </ComboboxPrimitive.Trigger>
      <ComboboxContent align="end" className="w-fit">
        <ComboboxInput showTrigger={false} placeholder={i18n.t("translationHub.searchLanguages")} />
        <ComboboxList>
          {(item: LanguageItem<LangCodeISO6393>) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxEmpty>{i18n.t("translationHub.noLanguagesFound")}</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  )
}
