/**
 * Subtitle custom CSS editor.
 *
 * The sibling of the page-translation editor, with one difference that shows: the draft lives on
 * the page rather than here, because the preview above renders from it live and the preset dropdown
 * writes into it. Saving is still explicit — a stylesheet is worth committing on purpose.
 */

import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import { useMemo } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Field } from "@/components/ui/base-ui/field"
import { CSSCodeEditor } from "@/components/ui/css-code-editor"
import { env } from "@/env"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { MAX_CUSTOM_CSS_LENGTH } from "@/types/config/translate"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { lintCSS } from "@/utils/css/lint-css"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

interface CSSEditorProps {
  value: string
  onChange: (value: string) => void
}

export function CSSEditor({ value, onChange }: CSSEditorProps) {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(
    configFieldsAtomMap.videoSubtitles,
  )
  const savedCSS = videoSubtitlesConfig.style.customCSS ?? ""

  const debouncedValue = useDebouncedValue(value, 500)

  const syntaxCheck = useMemo(() => {
    if (!debouncedValue.trim()) {
      return { valid: true, errors: [] }
    }
    return lintCSS(debouncedValue)
  }, [debouncedValue])

  const hasLengthError = debouncedValue.length > MAX_CUSTOM_CSS_LENGTH
  const hasSyntaxError = !syntaxCheck.valid
  const isValidating = value !== debouncedValue
  const hasChanges = value !== savedCSS

  const handleSave = () => {
    if (hasSyntaxError || hasLengthError || isValidating || !hasChanges) {
      return
    }

    // Cleared back to empty means off, and the schema spells that `null` rather than `""`.
    const customCSS = value.trim() ? value : null
    void setVideoSubtitlesConfig(deepmerge(videoSubtitlesConfig, { style: { customCSS } }))
  }

  return (
    <Field>
      {/* The section heading already names this editor, so the row carries only the docs link. */}
      <div className="flex items-start justify-end">
        <a
          href={`${env.WXT_WEBSITE_URL}/docs/subtitle-custom-css`}
          className="text-xs text-link hover:opacity-90"
          target="_blank"
          rel="noreferrer"
        >
          {i18n.t("options.videoSubtitles.style.customCSS.editor.docsLink")}
        </a>
      </div>
      <CSSCodeEditor
        value={value}
        onChange={onChange}
        hasError={hasSyntaxError || hasLengthError}
        placeholder={i18n.t("options.videoSubtitles.style.customCSS.editor.placeholder")}
        className="max-h-[400px] min-h-[200px] overflow-y-auto"
      />
      <div className="flex items-center justify-between gap-2">
        <div
          className={cn(
            "text-sm text-green-500",
            isValidating && "text-muted-foreground",
            (hasSyntaxError || hasLengthError) && "text-destructive",
          )}
        >
          {value.trim().length > 0
            ? getValidationMessage(isValidating, hasSyntaxError, hasLengthError, hasChanges)
            : ""}
        </div>
        <Button
          onClick={handleSave}
          disabled={isValidating || hasSyntaxError || hasLengthError || !hasChanges}
        >
          {hasChanges
            ? i18n.t("options.videoSubtitles.style.customCSS.editor.saveButton")
            : i18n.t("options.videoSubtitles.style.customCSS.editor.savedButton")}
        </Button>
      </div>
    </Field>
  )
}

function getValidationMessage(
  isValidating: boolean,
  hasSyntaxError: boolean,
  hasLengthError: boolean,
  hasChanges: boolean,
) {
  if (isValidating) {
    return i18n.t("options.videoSubtitles.style.customCSS.editor.validation.validating")
  }

  if (hasSyntaxError) {
    return i18n.t("options.videoSubtitles.style.customCSS.editor.validation.syntaxError")
  }

  if (hasLengthError) {
    return i18n.t("options.videoSubtitles.style.customCSS.editor.validation.tooLong")
  }

  if (!hasChanges) {
    return i18n.t("options.videoSubtitles.style.customCSS.editor.validation.saved")
  }

  return i18n.t("options.videoSubtitles.style.customCSS.editor.validation.valid")
}
