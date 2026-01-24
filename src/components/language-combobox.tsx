import type { LangCodeISO6393 } from '@read-frog/definitions'
import { i18n } from '#imports'
import {
  LANG_CODE_TO_LOCALE_NAME,
  langCodeISO6393Schema,
} from '@read-frog/definitions'
import { camelCase } from 'case-anything'
import { useMemo } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/base-ui/combobox'

interface LanguageItem {
  value: LangCodeISO6393 | 'auto'
  label: string
}

function getLanguageItems(detectedLangCode?: LangCodeISO6393): LanguageItem[] {
  const items: LanguageItem[] = langCodeISO6393Schema.options.map(code => ({
    value: code,
    label: `${i18n.t(`languages.${camelCase(code)}` as Parameters<typeof i18n.t>[0])} (${LANG_CODE_TO_LOCALE_NAME[code]})`,
  }))

  if (detectedLangCode) {
    items.unshift({
      value: 'auto',
      label: `${i18n.t(`languages.${camelCase(detectedLangCode)}` as Parameters<typeof i18n.t>[0])} (${LANG_CODE_TO_LOCALE_NAME[detectedLangCode]})`,
    })
  }

  return items
}

function filterLanguage(item: LanguageItem, query: string): boolean {
  const searchLower = query.toLowerCase()
  return item.label.toLowerCase().includes(searchLower)
    || item.value.toLowerCase().includes(searchLower)
}

function AutoBadge() {
  return <span className="rounded-full bg-neutral-200 px-1 text-xs dark:bg-neutral-800">auto</span>
}

interface LanguageComboboxProps {
  value: LangCodeISO6393 | 'auto'
  onValueChange: (value: LangCodeISO6393 | 'auto') => void
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
        placeholder={placeholder ?? i18n.t('translationHub.searchLanguages')}
      />
      <ComboboxContent className="w-fit">
        <ComboboxList>
          {(item: LanguageItem) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
              {item.value === 'auto' && <AutoBadge />}
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxEmpty>{i18n.t('translationHub.noLanguagesFound')}</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  )
}
