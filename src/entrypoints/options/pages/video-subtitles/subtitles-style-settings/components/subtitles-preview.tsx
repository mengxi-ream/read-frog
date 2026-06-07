import { useAtomValue } from "jotai"
import { i18n } from "#imports"
import { GradientBackground } from "@/components/gradient-background"
import { Label } from "@/components/ui/base-ui/label"
import { SubtitlesPair } from "@/entrypoints/subtitles.content/ui/subtitle-lines"
import { configFieldsAtomMap } from "@/utils/atoms/config"

export function SubtitlesPreview() {
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const { displayMode, translationPosition, lineGap, container } = style

  const sampleOriginal = "Mr. Kamiya is not fighting against the world, but against things that could make the world take notice."
  const sampleTranslation = "神谷先生不是在对抗世界，而是在对抗可能让世界为之侧目的事物。"

  const translationAbove = translationPosition === "above"
  const showMain = displayMode !== "translationOnly"
  const showTranslation = displayMode !== "originalOnly"

  return (
    <div className="mb-4">
      <Label className="mb-2 block text-sm font-medium">
        {i18n.t("options.videoSubtitles.style.preview")}
      </Label>
      <GradientBackground>
        <div className="relative w-fit min-w-full min-h-32 rounded-lg overflow-hidden flex items-center justify-center p-4">
          <div className="mt-3 px-3 py-2 rounded text-center text-white max-w-[90%]">
            <SubtitlesPair
              mainText={sampleOriginal}
              mainStyle={style.main}
              translationText={sampleTranslation}
              translationStyle={style.translation}
              showMain={showMain}
              showTranslation={showTranslation}
              translationAbove={translationAbove}
              backgroundOpacity={container.backgroundOpacity}
              lineGap={lineGap}
            />
          </div>
        </div>
      </GradientBackground>
    </div>
  )
}
