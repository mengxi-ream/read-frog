import type { LangCodeISO6393 } from '@read-frog/definitions'
import { i18n } from '#imports'
import {
  LANG_CODE_TO_LOCALE_NAME,
  langCodeISO6393Schema,
} from '@read-frog/definitions'
import { camelCase } from 'case-anything'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/base-ui/combobox'

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

interface LanguageComboboxProps {
  value: LangCodeISO6393
  onValueChange: (value: LangCodeISO6393) => void
  placeholder?: string
  className?: string
}

export function LanguageCombobox({
  value,
  onValueChange,
  placeholder,
  className,
}: LanguageComboboxProps) {
  const languageItems = getLanguageItems()

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
        placeholder={placeholder ?? i18n.t('translationHub.searchLanguages')}
      />
      <ComboboxContent className="w-fit">
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
