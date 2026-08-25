import type { CSSProperties } from "react"
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

/**
 * The picked style, as custom properties rather than the properties themselves. `subtitle-lines.css`
 * turns them into real declarations; going through a variable is what lets custom CSS override a
 * colour or size without `!important`, since an inline `color` would outrank every stylesheet rule.
 */
function getTextStyleVars(textStyle: SubtitleTextStyle): CSSProperties {
  return {
    "--rf-subtitle-font-family":
      SUBTITLE_FONT_FAMILIES[textStyle.fontFamily] || SUBTITLE_FONT_FAMILIES.system,
    "--rf-subtitle-font-size": `${textStyle.fontScale / 100}em`,
    "--rf-subtitle-color": textStyle.color,
    "--rf-subtitle-font-weight": String(textStyle.fontWeight),
  } as CSSProperties
}

export function MainSubtitle({ content, className }: SubtitleLineProps) {
  const subtitle = useAtomValue(displaySubtitleAtom)
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const text = content ?? subtitle?.text ?? ""

  return (
    <div
      className={cn("subtitles-main text-xl leading-tight", className)}
      style={getTextStyleVars(style.main)}
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
  const textStyleVars = getTextStyleVars(style.translation)
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
        // The pending label deliberately does not take the picked weight: it is a placeholder, not
        // the translation, and inherits whatever the box uses.
        style={{ ...textStyleVars, "--rf-subtitle-font-weight": undefined } as CSSProperties}
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
      style={textStyleVars}
      dir={dir}
      lang={lang}
    >
      {text}
    </div>
  )
}
