import type { ReactNode } from "react"
import type { SubtitleTextStyle } from "@/types/config/subtitles"
import { useAtomValue } from "jotai"
import { useId, useLayoutEffect, useRef } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { SUBTITLE_FONT_FAMILIES } from "@/utils/constants/subtitles"
import { getLanguageDirectionAndLang } from "@/utils/content/language-direction"
import { cn } from "@/utils/styles/utils"
import { currentSubtitleAtom } from "../atoms"

interface SubtitleLineProps {
  content?: string
  className?: string
  backgroundOpacity?: number
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

function SubtitleSVG({ text, style, className, dir, lang, backgroundOpacity }: {
  text: string
  style: SubtitleTextStyle
  className?: string
  dir?: string
  lang?: string
  backgroundOpacity?: number
}) {
  const shadowId = useId()
  const si = style.fontShadowIntensity
  const sw = style.fontStrokeWidth
  const hasStroke = sw > 0
  const lines = text.split("\n")
  const lineCount = lines.length
  const fontFamily = SUBTITLE_FONT_FAMILIES[style.fontFamily] || SUBTITLE_FONT_FAMILIES.system
  const rectRef = useRef<SVGRectElement>(null)
  const shadowTextRef = useRef<SVGTextElement>(null)

  useLayoutEffect(() => {
    const rect = rectRef.current
    const textEl = shadowTextRef.current
    if (!rect || !textEl || !backgroundOpacity)
      return
    const box = textEl.getBBox()
    const shadowPad = si > 0 ? Math.max(1, si * 0.5) + si : 0
    const strokePad = sw / 2
    const pad = Math.max(shadowPad, strokePad, 0) + 4
    rect.setAttribute("x", String(box.x - pad))
    rect.setAttribute("y", String(box.y - pad))
    rect.setAttribute("width", String(box.width + pad * 2))
    rect.setAttribute("height", String(box.height + pad * 2))
  })

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
      {!!backgroundOpacity && (
        <rect
          ref={rectRef}
          rx="4"
          fill="#000"
          opacity={backgroundOpacity / 100}
        />
      )}
      {/* Shadow layer: fill + feDropShadow only, no stroke */}
      {si > 0 && (
        <text
          ref={shadowTextRef}
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

      {/* Stroke+fill layer: SVG round join eliminates spikes, no shadow */}
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

export function SubtitlesPair({
  mainText, mainStyle,
  translationText, translationStyle,
  showMain, showTranslation,
  translationAbove, backgroundOpacity,
  dir, lang,
}: {
  mainText: string
  mainStyle: SubtitleTextStyle
  translationText: string
  translationStyle: SubtitleTextStyle
  showMain: boolean
  showTranslation: boolean
  translationAbove: boolean
  backgroundOpacity?: number
  dir?: string
  lang?: string
}) {
  const shadowId = useId()
  const groupRef = useRef<SVGGElement>(null)
  const rectRef = useRef<SVGRectElement>(null)
  const fontFamily = SUBTITLE_FONT_FAMILIES[mainStyle.fontFamily] || SUBTITLE_FONT_FAMILIES.system

  useLayoutEffect(() => {
    const rect = rectRef.current
    const group = groupRef.current
    if (!rect || !group || !backgroundOpacity)
      return
    const box = group.getBBox()
    const si = Math.max(mainStyle.fontShadowIntensity, translationStyle.fontShadowIntensity)
    const sw = Math.max(mainStyle.fontStrokeWidth, translationStyle.fontStrokeWidth)
    const shadowPad = si > 0 ? Math.max(1, si * 0.5) + si : 0
    const strokePad = sw / 2
    const pad = Math.max(shadowPad, strokePad, 0) + 4
    rect.setAttribute("x", String(box.x - pad))
    rect.setAttribute("y", String(box.y - pad))
    rect.setAttribute("width", String(box.width + pad * 2))
    rect.setAttribute("height", String(box.height + pad * 2))
  })

  const items: { text: string, style: SubtitleTextStyle, key: string }[] = []
  if (showMain && showTranslation) {
    if (translationAbove) {
      items.push({ text: translationText, style: translationStyle, key: "t" })
      items.push({ text: mainText, style: mainStyle, key: "m" })
    }
    else {
      items.push({ text: mainText, style: mainStyle, key: "m" })
      items.push({ text: translationText, style: translationStyle, key: "t" })
    }
  }
  else if (showMain) {
    items.push({ text: mainText, style: mainStyle, key: "m" })
  }
  else if (showTranslation) {
    items.push({ text: translationText, style: translationStyle, key: "t" })
  }

  return (
    <svg
      className="subtitles-main leading-tight text-xl"
      width="100%"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <ShadowFilter si={mainStyle.fontShadowIntensity} id={`shadow-m-${shadowId}`} />
        <ShadowFilter si={translationStyle.fontShadowIntensity} id={`shadow-t-${shadowId}`} />
      </defs>
      {!!backgroundOpacity && <rect ref={rectRef} rx="4" fill="#000" opacity={backgroundOpacity / 100} />}
      <g ref={groupRef}>
        {items.map((item, i) => {
          const si = item.style.fontShadowIntensity
          const sw = item.style.fontStrokeWidth
          const hasStroke = sw > 0
          const fid = `shadow-${item.key}-${shadowId}`
          return (
            <g key={item.key}>
              {si > 0 && (
                <text
                  x="50%"
                  dy={i ? "1.3em" : undefined}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily={fontFamily}
                  fontSize={`${item.style.fontScale / 100}em`}
                  fontWeight={item.style.fontWeight}
                  fill={item.style.color}
                  stroke="none"
                  filter={`url(#${fid})`}
                  direction={dir === "rtl" ? "rtl" : undefined}
                  lang={lang}
                >
                  {item.text}
                </text>
              )}
              <text
                x="50%"
                dy={i ? "1.3em" : undefined}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={fontFamily}
                fontSize={`${item.style.fontScale / 100}em`}
                fontWeight={item.style.fontWeight}
                fill={item.style.color}
                direction={dir === "rtl" ? "rtl" : undefined}
                stroke={hasStroke ? "rgba(0,0,0,0.8)" : "none"}
                strokeWidth={hasStroke ? sw : 0}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeMiterlimit={2}
                paintOrder={hasStroke ? "stroke fill" : undefined}
                lang={lang}
              >
                {item.text}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

export function MainSubtitle({ content, className, backgroundOpacity }: SubtitleLineProps) {
  const subtitle = useAtomValue(currentSubtitleAtom)
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const text = content ?? subtitle?.text ?? ""

  return (
    <SubtitleSVG
      text={text}
      style={style.main}
      className={cn("subtitles-main leading-tight text-xl", className)}
      backgroundOpacity={backgroundOpacity}
    />
  )
}

export function TranslationSubtitle({ content, className, backgroundOpacity }: SubtitleLineProps) {
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
      backgroundOpacity={backgroundOpacity}
      dir={dir}
      lang={lang}
    />
  )
}
