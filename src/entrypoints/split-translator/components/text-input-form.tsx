import type { FormEvent } from "react"
import { i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { Textarea } from "@/components/ui/base-ui/textarea"

export function TextInputForm({
  disabled,
  isTranslating,
  onChange,
  onSubmit,
  value,
}: {
  disabled: boolean
  isTranslating: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  value: string
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
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
