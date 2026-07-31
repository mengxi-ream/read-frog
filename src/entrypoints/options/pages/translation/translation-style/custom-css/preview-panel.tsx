import { LANG_CODE_ISO6391_OPTIONS } from "@read-frog/definitions"
import { useState } from "react"
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
import { PREVIEW_TEXT, StylePreview } from "../style-preview"

/**
 * The preview, plus the knobs only custom CSS needs: rules can key off language and direction,
 * so the writer has to be able to point the sample at either one.
 */
export function PreviewPanel() {
  const [language, setLanguage] = useState("zh")
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr")
  const [text, setText] = useState(PREVIEW_TEXT)

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
              if (value) setLanguage(value)
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
          <Select value={dir} onValueChange={(value) => setDir(value as "ltr" | "rtl")}>
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
          onChange={(e) => setText(e.target.value)}
          className="min-h-20"
        />
      </Field>

      <StylePreview text={text} language={language} dir={dir} />
    </div>
  )
}
