import type { SubtitleTextStyle } from "@/types/config/subtitles"
import { useAtomValue } from "jotai"
import { Fragment, useState } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { SUBTITLE_FONT_FAMILIES } from "@/utils/constants/subtitles"
import { getLanguageDirectionAndLang } from "@/utils/content/language-direction"
import { cn } from "@/utils/styles/utils"
import { currentSubtitleAtom } from "../atoms"

interface SubtitleLineProps {
  content?: string
  className?: string
}

const TRANSLATION_BLUR_FILTER = "blur(0.25em)"

function getTextStyles(textStyle: SubtitleTextStyle) {
  return {
    fontFamily: SUBTITLE_FONT_FAMILIES[textStyle.fontFamily] || SUBTITLE_FONT_FAMILIES.system,
    fontSize: `${textStyle.fontScale / 100}em`,
    color: textStyle.color,
    fontWeight: textStyle.fontWeight,
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

/** Remount resets reveal state when cue, translation text, or blur toggle identity changes */
function TranslationRevealBody({
  className,
  dir,
  lang,
  text,
  blurTranslation,
  textStyle,
}: {
  className?: string
  dir: string | undefined
  lang: string | undefined
  text: string
  blurTranslation: boolean
  textStyle: SubtitleTextStyle
}) {
  const [revealedForText, setRevealedForText] = useState(false)
  const blurStyle = blurTranslation && !revealedForText
    ? { filter: TRANSLATION_BLUR_FILTER, opacity: 0.75, transition: "none" }
    : blurTranslation
      ? { filter: "blur(0)", opacity: 1, transition: "filter 0.15s ease-in-out, opacity 0.15s ease-in-out" }
      : undefined

  return (
    <div
      className={cn("subtitles-translation leading-tight text-xl", className)}
      style={{ ...getTextStyles(textStyle), ...blurStyle }}
      dir={dir}
      lang={lang}
      onMouseEnter={() => blurTranslation && setRevealedForText(true)}
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

  const blurTranslation = style.blurTranslation
  const cueId = subtitle
    ? `${subtitle.start}:${subtitle.end}`
    : "no-active-cue"

  /* Include blurTranslation so off→on resets reveal for the same cue+text. */
  const remountKey = `${cueId}|${text}|${blurTranslation ? "1" : "0"}`

  return (
    <Fragment key={remountKey}>
      <TranslationRevealBody
        className={className}
        dir={dir}
        lang={lang}
        text={text}
        blurTranslation={blurTranslation}
        textStyle={style.translation}
      />
    </Fragment>
  )
}
