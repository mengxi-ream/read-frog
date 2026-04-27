import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { FormEvent } from "react"
import { i18n } from "#imports"
import {
  LANG_CODE_TO_EN_NAME,
  LANG_CODE_TO_LOCALE_NAME,
  langCodeISO6393Schema,
} from "@read-frog/definitions"
import { Button } from "@/components/ui/base-ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { Textarea } from "@/components/ui/base-ui/textarea"

function langCodeLabel(langCode: LangCodeISO6393) {
  return `${LANG_CODE_TO_EN_NAME[langCode]} (${LANG_CODE_TO_LOCALE_NAME[langCode]})`
}

export function TextInputForm({
  disabled,
  isTranslating,
  onChange,
  onSubmit,
  onTargetLanguageChange,
  targetLanguage,
  value,
}: {
  disabled: boolean
  isTranslating: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onTargetLanguageChange: (value: LangCodeISO6393) => void
  targetLanguage: LangCodeISO6393
  value: string
}) {
  const targetLanguageLabel = i18n.t("splitTranslator.targetLanguageLabel" as never)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <label className="space-y-2">
        <span className="text-sm font-medium">
          {targetLanguageLabel}
        </span>
        <Select
          value={targetLanguage}
          disabled={isTranslating}
          onValueChange={value => onTargetLanguageChange(value as LangCodeISO6393)}
        >
          <SelectTrigger aria-label={targetLanguageLabel} className="w-full min-w-0" disabled={isTranslating}>
            <SelectValue render={<span className="flex-1 min-w-0" />}>
              <span className="block min-w-0 truncate">{langCodeLabel(targetLanguage)}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-64" align="start">
            <SelectGroup>
              {langCodeISO6393Schema.options.map(code => (
                <SelectItem key={code} value={code}>
                  {langCodeLabel(code)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium">
          {i18n.t("splitTranslator.inputLabel")}
        </span>
        <Textarea
          aria-label={i18n.t("splitTranslator.inputLabel")}
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={i18n.t("splitTranslator.inputPlaceholder")}
          className="min-h-48 resize-y text-base"
          disabled={isTranslating}
        />
      </label>
      <Button type="submit" className="w-full" disabled={disabled || isTranslating}>
        {isTranslating ? i18n.t("splitTranslator.translating") : i18n.t("splitTranslator.translate")}
      </Button>
    </form>
  )
}
