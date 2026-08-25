import { LANG_CODE_ISO6391_OPTIONS } from "@read-frog/definitions"
import { Field, FieldLabel } from "@/components/ui/base-ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { Textarea } from "@/components/ui/base-ui/textarea"
import { i18n } from "@/utils/i18n"

export interface PreviewControlsProps {
  language: string
  onLanguageChange: (language: string) => void
  dir: "ltr" | "rtl"
  onDirChange: (dir: "ltr" | "rtl") => void
  text: string
  onTextChange: (text: string) => void
}

/**
 * The knobs only custom CSS needs: rules can key off language and direction, so the writer has to
 * be able to point the sample at either one. They hold no state — the preview they drive sits at
 * the top of the page, above the editor, so the page owns it.
 */
export function PreviewControls({
  language,
  onLanguageChange,
  dir,
  onDirChange,
  text,
  onTextChange,
}: PreviewControlsProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="language-select">
            {i18n.t("options.translation.translationStyle.stylePreviewLanguage")}
          </FieldLabel>
          <Select
            value={language}
            onValueChange={(value) => {
              if (value) onLanguageChange(value)
            }}
          >
            <SelectTrigger id="language-select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {LANG_CODE_ISO6391_OPTIONS.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="dir-select">
            {i18n.t("options.translation.translationStyle.stylePreviewDirection")}
          </FieldLabel>
          <Select value={dir} onValueChange={(value) => onDirChange(value as "ltr" | "rtl")}>
            <SelectTrigger id="dir-select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ltr">ltr (Left to Right)</SelectItem>
                <SelectItem value="rtl">rtl (Right to Left)</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="preview-text">
          {i18n.t("options.translation.translationStyle.stylePreviewTranslatedText")}
        </FieldLabel>
        <Textarea
          id="preview-text"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          className="min-h-20"
        />
      </Field>
    </div>
  )
}
