import type { ReactNode } from "react"
import type { SubtitleTextStyle } from "@/types/config/subtitles"
import { useId, useLayoutEffect, useRef } from "react"
import { SUBTITLE_FONT_FAMILIES } from "@/utils/constants/subtitles"

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

export function SubtitlesPair({
  mainText, mainStyle,
  translationText, translationStyle,
  showMain, showTranslation,
  translationAbove, backgroundOpacity,
  lineGap = 1.3,
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
  lineGap?: number
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

  const lineCount = (showMain ? 1 : 0) + (showTranslation ? 1 : 0)
  const svgHeight = `${1.5 + (lineCount - 1) * lineGap}em`

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
      height={svgHeight}
      style={{ display: "block", overflow: "visible", pointerEvents: "auto", userSelect: "text" }}
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
                  dy={i ? `${lineGap}em` : undefined}
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
                dy={i ? `${lineGap}em` : undefined}
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
