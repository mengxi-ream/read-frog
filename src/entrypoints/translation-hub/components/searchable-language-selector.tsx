import type { LangCodeISO6393 } from '@read-frog/definitions'
import { FieldLabel, FieldRoot } from '@/components/base-ui/field'
import { LanguageCombobox } from '@/components/language-combobox'

interface SearchableLanguageSelectorProps {
  value: LangCodeISO6393
  onValueChange: (value: LangCodeISO6393) => void
  label: string
}

export function SearchableLanguageSelector({
  value,
  onValueChange,
  label,
}: SearchableLanguageSelectorProps) {
  return (
    <FieldRoot>
      <FieldLabel>{label}</FieldLabel>
      <LanguageCombobox value={value} onValueChange={onValueChange} />
    </FieldRoot>
  )
}
