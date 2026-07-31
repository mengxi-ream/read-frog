import type { SubtitleTextStyle } from "@/types/config/subtitles"
import { useAtomValue } from "jotai"
import { useEffect, useRef } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { SUBTITLE_FONT_FAMILIES } from "@/utils/constants/subtitles"
import { getLanguageDirectionAndLang } from "@/utils/content/language-direction"
import { cn } from "@/utils/styles/utils"
import { isTranslationPending } from "@/utils/subtitles/display-rules"
import { displaySubtitleAtom } from "../atoms"
import { SubtitlePendingLabel } from "./subtitle-pending-label"

interface SubtitleLineProps {
  content?: string
  className?: string
}

function getTextStyles(textStyle: SubtitleTextStyle) {
  return {
    fontFamily: SUBTITLE_FONT_FAMILIES[textStyle.fontFamily] || SUBTITLE_FONT_FAMILIES.system,
    fontSize: `${textStyle.fontScale / 100}em`,
    color: textStyle.color,
    fontWeight: textStyle.fontWeight,
  }
}

export function MainSubtitle({ content, className }: SubtitleLineProps) {
  const subtitle = useAtomValue(displaySubtitleAtom)
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const text = content ?? subtitle?.text ?? ""

  return (
    <div
      className={cn("subtitles-main text-xl leading-tight", className)}
      style={getTextStyles(style.main)}
    >
      {text}
    </div>
  )
}

export function TranslationSubtitle({ content, className }: SubtitleLineProps) {
  const subtitle = useAtomValue(displaySubtitleAtom)
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const language = useAtomValue(configFieldsAtomMap.language)
  const pending = content === undefined && isTranslationPending(subtitle)
  const text = content ?? subtitle?.translation ?? ""
  const { dir, lang } = getLanguageDirectionAndLang(language.targetCode)
  const textStyles = getTextStyles(style.translation)
  const lastFrameRef = useRef<{ start?: number; pending: boolean }>({
    start: undefined,
    pending: false,
  })
  const justResolved =
    !pending &&
    !!text &&
    lastFrameRef.current.pending &&
    lastFrameRef.current.start === subtitle?.start

  useEffect(() => {
    lastFrameRef.current = { start: subtitle?.start, pending }
  })

  if (pending) {
    return (
      <div
        className={cn(
          "subtitles-translation flex min-h-[1.25em] items-center justify-center leading-tight",
          className,
        )}
        style={{
          fontFamily: textStyles.fontFamily,
          fontSize: textStyles.fontSize,
          color: textStyles.color,
        }}
        dir={dir}
        lang={lang}
        data-pending="true"
        aria-busy="true"
      >
        <SubtitlePendingLabel key={subtitle?.start} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "subtitles-translation text-xl leading-tight",
        justResolved && "animate-subtitle-fade-in",
        className,
      )}
      style={textStyles}
      dir={dir}
      lang={lang}
    >
      {text}
    </div>
  )
}
