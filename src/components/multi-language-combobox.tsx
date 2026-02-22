import type { LangCodeISO6393 } from '@read-frog/definitions'
import { i18n } from '#imports'
import { Combobox as ComboboxPrimitive } from '@base-ui/react'
import { Icon } from '@iconify/react'
import {
  LANG_CODE_TO_LOCALE_NAME,
  langCodeISO6393Schema,
} from '@read-frog/definitions'
import { camelCase } from 'case-anything'
import { useMemo } from 'react'
import { Button } from '@/components/ui/base-ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/base-ui/combobox'

interface LanguageItem {
  value: LangCodeISO6393
  label: string
}

function getLanguageItems(): LanguageItem[] {
  return langCodeISO6393Schema.options.map(code => ({
    value: code,
    label: `${i18n.t(`languages.${camelCase(code)}` as Parameters<typeof i18n.t>[0])} (${LANG_CODE_TO_LOCALE_NAME[code]})`,
  }))
}

function filterLanguage(item: LanguageItem, query: string): boolean {
  const searchLower = query.toLowerCase()
  return item.label.toLowerCase().includes(searchLower)
    || item.value.toLowerCase().includes(searchLower)
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
      onValueChange={(items: LanguageItem[]) => {
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
        <ComboboxInput showTrigger={false} placeholder={i18n.t('translationHub.searchLanguages')} />
        <ComboboxList>
          {(item: LanguageItem) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxEmpty>{i18n.t('translationHub.noLanguagesFound')}</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  )
}
