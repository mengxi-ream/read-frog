import type { SubtitleTextStyle } from "@/types/config/subtitles"
import { useAtomValue } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { SUBTITLE_FONT_FAMILIES } from "@/utils/constants/subtitles"
import { getLanguageDirectionAndLang } from "@/utils/content/language-direction"
import { cn } from "@/utils/styles/utils"
import { currentSubtitleAtom } from "../atoms"

interface SubtitleLineProps {
  content?: string
  className?: string
}

function getTextStyles(textStyle: SubtitleTextStyle) {
  const hasShadow = textStyle.fontShadowIntensity > 0
  const si = textStyle.fontShadowIntensity
  return {
    fontFamily: SUBTITLE_FONT_FAMILIES[textStyle.fontFamily] || SUBTITLE_FONT_FAMILIES.system,
    fontSize: `${textStyle.fontScale / 100}em`,
    color: textStyle.color,
    fontWeight: textStyle.fontWeight,
    textShadow: hasShadow ? `${Math.max(1, si * 0.25).toFixed(1)}px ${Math.max(1, si * 0.5).toFixed(1)}px ${si}px rgba(0,0,0,${(0.5 + (si / 8) * 0.5).toFixed(2)})` : "none",
    WebkitTextStroke: textStyle.fontStrokeWidth > 0 ? `${textStyle.fontStrokeWidth}px rgba(0,0,0,0.8)` : "0",
    paintOrder: "stroke fill" as const,
  }
}

export function MainSubtitle({ content, className }: SubtitleLineProps) {
  const subtitle = useAtomValue(currentSubtitleAtom)
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const text = content ?? subtitle?.text ?? ""

  return (
    <div
      className={cn("subtitles-main leading-tight text-xl", className)}
      style={getTextStyles(style.main)}
    >
      {text}
    </div>
  )
}

export function TranslationSubtitle({ content, className }: SubtitleLineProps) {
  const subtitle = useAtomValue(currentSubtitleAtom)
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const language = useAtomValue(configFieldsAtomMap.language)
  const text = content ?? subtitle?.translation ?? ""
  const { dir, lang } = getLanguageDirectionAndLang(language.targetCode)

  return (
    <div
      className={cn("subtitles-translation leading-tight text-xl", className)}
      style={getTextStyles(style.translation)}
      dir={dir}
      lang={lang}
    >
      {text}
    </div>
  )
}
