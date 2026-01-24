import type { LangCodeISO6393 } from '@read-frog/definitions'
import { FieldLabel, FieldRoot } from '@/components/base-ui/field'
import { LanguageCombobox } from '@/components/language-combobox'

interface SearchableLanguageSelectorProps {
  value: LangCodeISO6393 | 'auto'
  onValueChange: (value: LangCodeISO6393 | 'auto') => void
  detectedLangCode?: LangCodeISO6393
  label: string
  className?: string
}

export function SearchableLanguageSelector({
  value,
  onValueChange,
  detectedLangCode,
  label,
  className,
}: SearchableLanguageSelectorProps) {
  return (
    <FieldRoot className={className}>
      <FieldLabel>{label}</FieldLabel>
      <LanguageCombobox
        value={value}
        onValueChange={onValueChange}
        detectedLangCode={detectedLangCode}
        className="w-full"
      />
    </FieldRoot>
  )
}
