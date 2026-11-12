import { useAtomValue } from "jotai"
import { Activity } from "react"
import videoStill from "@/assets/preview/video-still.webp"
import {
  MainSubtitle,
  TranslationSubtitle,
} from "@/entrypoints/subtitles.content/ui/subtitle-lines"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { SUBTITLES_BOX_CLASS, SUBTITLES_VIEW_CLASS } from "@/utils/constants/subtitles"
import { cn } from "@/utils/styles/utils"
import { PreviewBackdrop } from "../../../../components/feature-preview"
import { ShadowPreviewFrame } from "./shadow-preview-frame"

/**
 * The card is wider than the stage the other previews share, so it steps down on a scale of its
 * own: each step keeps it 24px clear of the backdrop's sides in the narrowest column it covers.
 */
const CARD_ZOOM_STEPS =
  "@max-4xl:[zoom:0.84] @max-3xl:[zoom:0.73] @max-2xl:[zoom:0.62] @max-xl:[zoom:0.54] @max-lg:[zoom:0.47] @max-md:[zoom:0.39] @max-sm:[zoom:0.32]"

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

  // A still from a video in a player-like frame, dark along the bottom like most footage, so the
  // subtitles read against what they will be read against: white text with no background shows.
  // Both sample lines stay on one line at the default size (the original runs to about 730px): the
  // box may take the frame's whole width rather than the 90% the overlay allows on a video, so the
  // card stays narrow enough for the backdrop.
  return (
    <PreviewBackdrop className="py-9">
      <div
        className={cn(
          "w-[848px] shrink-0 rounded-[18px] bg-white p-1.5 dark:bg-neutral-800",
          "shadow-[0_1px_2px_rgb(0_0_0/0.06),0_18px_40px_-14px_rgb(28_36_18/0.3)]",
          CARD_ZOOM_STEPS,
        )}
      >
        <div
          className="relative overflow-hidden rounded-xl bg-cover bg-center"
          style={{ backgroundImage: `url("${videoStill}")` }}
        >
          <ShadowPreviewFrame
            customCSS={previewCSS ?? style.customCSS ?? ""}
            className="relative h-fit w-fit min-w-full"
          >
            {/* The same class hooks the real overlay carries, in the same nesting, so a selector
                written against the documented names matches here exactly as it will on the video. */}
            <div
              className={cn(
                SUBTITLES_VIEW_CLASS,
                "flex min-h-61 w-full items-end justify-center px-4 pt-4 pb-8",
              )}
            >
              <div
                className={cn(
                  SUBTITLES_BOX_CLASS,
                  "flex max-w-full flex-col gap-2 rounded px-3 py-2 text-center text-white",
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
          {/* A player's progress bar, which subtitles sit just above. */}
          <div className="pointer-events-none absolute inset-x-4 bottom-3 h-[3px] rounded-full bg-white/30">
            <div className="h-full w-[38%] rounded-full bg-white/90" />
            <div className="absolute top-1/2 left-[38%] size-2.5 -translate-1/2 rounded-full bg-white" />
          </div>
        </div>
      </div>
    </PreviewBackdrop>
  )
}
