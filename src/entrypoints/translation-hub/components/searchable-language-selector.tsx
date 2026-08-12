import type { LangCodeISO6393 } from "@read-frog/definitions"
import { LanguageCombobox } from "@/components/language-combobox"
import { Field, FieldTitle } from "@/components/ui/base-ui/field"

interface SearchableLanguageSelectorProps {
  value: LangCodeISO6393 | "auto"
  onValueChange: (value: LangCodeISO6393 | "auto") => void
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
    <Field className={className}>
      <FieldTitle>{label}</FieldTitle>
      <LanguageCombobox
        value={value}
        onValueChange={onValueChange}
        detectedLangCode={detectedLangCode}
        className="w-full"
      />
    </Field>
  )
}
