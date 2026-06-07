import type { ReactNode } from "react"
import type { SubtitleTextStyle } from "@/types/config/subtitles"
import { useAtomValue } from "jotai"
import { useId } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { SUBTITLE_FONT_FAMILIES } from "@/utils/constants/subtitles"
import { getLanguageDirectionAndLang } from "@/utils/content/language-direction"
import { cn } from "@/utils/styles/utils"
import { currentSubtitleAtom } from "../atoms"

interface SubtitleLineProps {
  content?: string
  className?: string
}

function ShadowFilter({ si, id }: { si: number, id: string }): ReactNode {
  if (si <= 0)
    return null
  const dx = Math.max(1, si * 0.25).toFixed(1)
  const dy = Math.max(1, si * 0.5).toFixed(1)
  const alpha = (0.5 + (si / 8) * 0.5).toFixed(2)
  return (
    <filter id={id} x="-200%" y="-200%" width="500%" height="500%">
      <feDropShadow dx={dx} dy={dy} stdDeviation={si} floodColor="#000" floodOpacity={alpha} />
    </filter>
  )
}

function SubtitleSVG({ text, style, className, dir, lang }: {
  text: string
  style: SubtitleTextStyle
  className?: string
  dir?: string
  lang?: string
}) {
  const shadowId = useId()
  const si = style.fontShadowIntensity
  const sw = style.fontStrokeWidth
  const hasStroke = sw > 0
  const lines = text.split("\n")
  const lineCount = lines.length
  const fontFamily = SUBTITLE_FONT_FAMILIES[style.fontFamily] || SUBTITLE_FONT_FAMILIES.system

  return (
    <svg
      className={className}
      width="100%"
      height={`${1.5 + (lineCount - 1) * 1.3}em`}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <ShadowFilter si={si} id={`shadow-${shadowId}`} />
      </defs>
      {/* 阴影层：纯填充 + feDropShadow，描边无关 */}
      {si > 0 && (
        <text
          x="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={fontFamily}
          fontSize={`${style.fontScale / 100}em`}
          fontWeight={style.fontWeight}
          fill={style.color}
          stroke="none"
          filter={`url(#shadow-${shadowId})`}
          lang={lang}
        >
          {lines.map((line, i) => (
            <tspan key={line} x="50%" dy={i ? "1.3em" : undefined}>
              {line}
            </tspan>
          ))}
        </text>
      )}

      {/* 描边+填充层：SVG round join 消除尖刺，无阴影 */}
      <text
        x="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={fontFamily}
        fontSize={`${style.fontScale / 100}em`}
        fontWeight={style.fontWeight}
        fill={style.color}
        direction={dir === "rtl" ? "rtl" : undefined}
        stroke={hasStroke ? "rgba(0,0,0,0.8)" : "none"}
        strokeWidth={hasStroke ? sw : 0}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeMiterlimit={2}
        paintOrder={hasStroke ? "stroke fill" : undefined}
        lang={lang}
      >
        {lines.map((line, i) => (
          <tspan key={line} x="50%" dy={i ? "1.3em" : undefined}>
            {line}
          </tspan>
        ))}
      </text>
    </svg>
  )
}

export function MainSubtitle({ content, className }: SubtitleLineProps) {
  const subtitle = useAtomValue(currentSubtitleAtom)
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const text = content ?? subtitle?.text ?? ""

  return (
    <SubtitleSVG
      text={text}
      style={style.main}
      className={cn("subtitles-main leading-tight text-xl", className)}
    />
  )
}

export function TranslationSubtitle({ content, className }: SubtitleLineProps) {
  const subtitle = useAtomValue(currentSubtitleAtom)
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const language = useAtomValue(configFieldsAtomMap.language)
  const text = content ?? subtitle?.translation ?? ""
  const { dir, lang } = getLanguageDirectionAndLang(language.targetCode)

  return (
    <SubtitleSVG
      text={text}
      style={style.translation}
      className={cn("subtitles-translation leading-tight text-xl", className)}
      dir={dir}
      lang={lang}
    />
  )
}
