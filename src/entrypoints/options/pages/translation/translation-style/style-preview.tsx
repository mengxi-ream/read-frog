import { useAtomValue } from "jotai"
import { useEffect, useState } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { BLOCK_CONTENT_CLASS, CONTENT_WRAPPER_CLASS } from "@/utils/constants/dom-labels"
import { decorateTranslationNode } from "@/utils/host/translate/ui/decorate-translation"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { PagePreviewFrame } from "./page-preview-frame"

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
  // A callback ref rather than `useRef`: the node is portalled into an iframe that mounts a frame
  // later than this component does, so the effect has to re-run when it finally appears.
  const [blockContent, setBlockContent] = useState<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (blockContent) {
      void decorateTranslationNode(blockContent, translationNodeStyle)
    }
  }, [blockContent, translationNodeStyle])

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <span className="text-sm leading-5 font-medium">
        {i18n.t("options.translation.translationStyle.preview")}
      </span>
      <div id="style-preview" className="w-full">
        <PagePreviewFrame>
          {/* No `text-sm`: production puts only the block-content class on this node, so pinning a
              font size here made the preview disagree with every real page about how big the text
              is. Inside the frame it inherits an ordinary 16px instead. */}
          <span className={CONTENT_WRAPPER_CLASS} lang={language} dir={dir}>
            <span className={BLOCK_CONTENT_CLASS} ref={setBlockContent}>
              {text}
            </span>
          </span>
        </PagePreviewFrame>
      </div>
    </div>
  )
}
