import type { SubtitleTextStyle } from "@/types/config/subtitles"
import { useAtomValue } from "jotai"
import { useEffect, useState } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  SUBTITLE_FONT_FAMILIES,
  TRANSLATION_PENDING_INDICATOR_DELAY_MS,
} from "@/utils/constants/subtitles"
import { getLanguageDirectionAndLang } from "@/utils/content/language-direction"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { isTranslationPending } from "@/utils/subtitles/display-rules"
import { currentSubtitleAtom } from "../atoms"
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
  const subtitle = useAtomValue(currentSubtitleAtom)
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
  const subtitle = useAtomValue(currentSubtitleAtom)
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const language = useAtomValue(configFieldsAtomMap.language)
  const pending = content === undefined && isTranslationPending(subtitle)
  const text = content ?? subtitle?.translation ?? ""
  const { dir, lang } = getLanguageDirectionAndLang(language.targetCode)
  const textStyles = getTextStyles(style.translation)

  const [showPendingDots, setShowPendingDots] = useState(false)
  const [fadeIn, setFadeIn] = useState(!pending && !!text)

  // Delay dots so fast translations never flash a pending state.
  useEffect(() => {
    if (!pending) {
      setShowPendingDots(false)
      return undefined
    }

    setShowPendingDots(false)
    const timerId = window.setTimeout(() => {
      setShowPendingDots(true)
    }, TRANSLATION_PENDING_INDICATOR_DELAY_MS)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [pending, subtitle?.start])

  // Fade in when a real translation appears for the current cue.
  // Double rAF so the browser commits opacity-0 before transitioning to 100.
  useEffect(() => {
    if (pending || !text) {
      setFadeIn(false)
      return undefined
    }

    setFadeIn(false)
    let secondFrameId = 0
    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        setFadeIn(true)
      })
    })
    return () => {
      window.cancelAnimationFrame(firstFrameId)
      window.cancelAnimationFrame(secondFrameId)
    }
  }, [pending, text, subtitle?.start])

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
        aria-label={i18n.t("subtitles.state.translating")}
      >
        {showPendingDots ? (
          <SubtitlePendingLabel label={i18n.t("subtitles.state.translating")} />
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "subtitles-translation text-xl leading-tight transition-opacity duration-200",
        fadeIn ? "opacity-100" : "opacity-0",
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
