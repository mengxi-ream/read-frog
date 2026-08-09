import { useAtomValue } from "jotai"
import { useEffect, useRef } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { BLOCK_CONTENT_CLASS, CONTENT_WRAPPER_CLASS } from "@/utils/constants/dom-labels"
import { decorateTranslationNode } from "@/utils/host/translate/ui/decorate-translation"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

/** The sample the preview shows until the CSS editor's own text box replaces it. */
export const PREVIEW_TEXT = "神谷先生不是在对抗世界，而是在对抗可能让世界为之侧目的事物。"

/**
 * A line of translated text wearing the configured style. Not a `ConfigItem` — it sets nothing,
 * it only shows what the row above it just chose.
 */
export function StylePreview({
  text = PREVIEW_TEXT,
  language = "zh",
  dir = "ltr",
  className,
}: {
  text?: string
  language?: string
  dir?: "ltr" | "rtl"
  className?: string
}) {
  const { translationNodeStyle } = useAtomValue(configFieldsAtomMap.pageTranslation)
  const blockContentRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (blockContentRef.current) {
      void decorateTranslationNode(blockContentRef.current, translationNodeStyle)
    }
  }, [translationNodeStyle])

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <span className="text-sm leading-5 font-medium">
        {i18n.t("options.translation.translationStyle.preview")}
      </span>
      <div id="style-preview" className="flex w-full flex-col gap-2 rounded-md border p-4">
        <span className={CONTENT_WRAPPER_CLASS} lang={language} dir={dir}>
          <span className={`text-sm ${BLOCK_CONTENT_CLASS}`} ref={blockContentRef}>
            {text}
          </span>
        </span>
      </div>
    </div>
  )
}
