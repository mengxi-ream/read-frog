import { useAtomValue } from "jotai"
import { Activity } from "react"
import { GradientBackground } from "@/components/gradient-background"
import {
  MainSubtitle,
  TranslationSubtitle,
} from "@/entrypoints/subtitles.content/ui/subtitle-lines"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { SUBTITLES_BOX_CLASS, SUBTITLES_VIEW_CLASS } from "@/utils/constants/subtitles"
import { cn } from "@/utils/styles/utils"
import { ShadowPreviewFrame } from "./shadow-preview-frame"

interface SubtitlesPreviewProps {
  /**
   * Custom CSS to show the effect of before it is saved. Omitted, the preview falls back to what
   * the config holds, so the style page shows the saved CSS rather than pretending there is none.
   */
  previewCSS?: string
}

export function SubtitlesPreview({ previewCSS }: SubtitlesPreviewProps) {
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const { displayMode, translationPosition, container } = style

  const sampleOriginal =
    "Mr. Kamiya is not fighting against the world, but against things that could make the world take notice."
  const sampleTranslation = "神谷先生不是在对抗世界，而是在对抗可能让世界为之侧目的事物。"

  const translationAbove = translationPosition === "above"
  const showMain = displayMode !== "translationOnly"
  const showTranslation = displayMode !== "originalOnly"

  const containerStyle = {
    backgroundColor: `rgba(0, 0, 0, ${container.backgroundOpacity / 100})`,
  }

  return (
    <GradientBackground>
      <ShadowPreviewFrame
        customCSS={previewCSS ?? style.customCSS ?? ""}
        className="relative h-fit w-fit min-w-full rounded-lg"
      >
        {/* The same class hooks the real overlay carries, in the same nesting, so a selector
            written against the documented names matches here exactly as it will on the video. */}
        <div
          className={cn(
            SUBTITLES_VIEW_CLASS,
            "flex min-h-32 w-full items-center justify-center p-4",
          )}
        >
          <div
            className={cn(
              SUBTITLES_BOX_CLASS,
              "flex max-w-[90%] flex-col gap-2 rounded px-3 py-2 text-center text-white",
            )}
            style={containerStyle}
          >
            <Activity mode={showMain ? "visible" : "hidden"}>
              <MainSubtitle
                content={sampleOriginal}
                className={cn("text-sm", translationAbove ? "order-2" : "order-1")}
              />
            </Activity>

            <Activity mode={showTranslation ? "visible" : "hidden"}>
              <TranslationSubtitle
                content={sampleTranslation}
                className={cn("text-sm", translationAbove ? "order-1" : "order-2")}
              />
            </Activity>
          </div>
        </div>
      </ShadowPreviewFrame>
    </GradientBackground>
  )
}
