import type { ReactNode } from "react"
import type { BackgroundStyle, SubtitleTextStyle } from "@/types/config/subtitles"
import { memo, useEffect, useMemo, useRef, useState } from "react"
import { SUBTITLE_FONT_FAMILIES } from "@/utils/constants/subtitles"

// ---- Singleton SVG text measurement ----

let _measureText: SVGTextElement | null = null

function measureTextWidth(text: string, fontFamily: string, fontWeight: number, fontSizePx: number): number {
  if (typeof document === "undefined")
    return 0
  if (!_measureText) {
    const ns = "http://www.w3.org/2000/svg"
    const svg = document.createElementNS(ns, "svg")
    svg.setAttribute("aria-hidden", "true")
    svg.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;top:-9999px;left:0"
    _measureText = document.createElementNS(ns, "text")
    svg.appendChild(_measureText)
    document.body.appendChild(svg)
  }
  _measureText.textContent = text
  _measureText.style.fontFamily = fontFamily
  _measureText.style.fontSize = `${fontSizePx}px`
  _measureText.style.fontWeight = String(fontWeight)
  return _measureText.getComputedTextLength()
}

// ---- Text wrapping ----

function wrapText(text: string, measure: (s: string) => number, maxWidth: number): string[] {
  if (measure(text) <= maxWidth)
    return [text]

  const lines: string[] = []

  if (/\s/.test(text)) {
    const words = text.split(/\s+/)
    let cur = words[0]
    for (let i = 1; i < words.length; i++) {
      const test = `${cur} ${words[i]}`
      if (measure(test) > maxWidth) {
        lines.push(cur)
        cur = words[i]
      }
      else {
        cur = test
      }
    }
    lines.push(cur)
  }
  else {
    const chars = [...text]
    let cur = chars[0]
    for (let i = 1; i < chars.length; i++) {
      const test = cur + chars[i]
      if (measure(test) > maxWidth) {
        lines.push(cur)
        cur = chars[i]
      }
      else {
        cur = test
      }
    }
    lines.push(cur)
  }

  return lines
}

// ---- Shadow Filter ----

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

// ---- Background padding ----

function getBgPad(si: number, sw: number): { pad: number, wPad: number } {
  const shadowPad = si > 0 ? Math.max(1, si * 0.5) + si : 0
  const strokePad = sw / 2
  const pad = Math.max(shadowPad, strokePad, 0)
  return { pad, wPad: pad + 12 }
}

// ---- SubtitleLine (pure SVG text rendering, no layout) ----

interface SubtitleLineProps {
  lines: string[]
  style: SubtitleTextStyle
  filterId: string
  dir?: string
  lang?: string
}

const SubtitleLine = memo(({ lines, style, filterId, dir, lang }: SubtitleLineProps) => {
  const fontFamily = SUBTITLE_FONT_FAMILIES[style.fontFamily] || SUBTITLE_FONT_FAMILIES.system
  const si = style.fontShadowIntensity
  const sw = style.fontStrokeWidth
  const hasStroke = sw > 0

  const textEl = (
    <text
      x="50%"
      y="0.5em"
      textAnchor="middle"
      dominantBaseline="central"
      fontFamily={fontFamily}
      fontSize={`${style.fontScale / 100}em`}
      fontWeight={style.fontWeight}
      fill={style.color}
      direction={dir}
      stroke={hasStroke ? "rgba(0,0,0,0.8)" : "none"}
      strokeWidth={hasStroke ? sw : 0}
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeMiterlimit={2}
      paintOrder={hasStroke ? "stroke fill" : undefined}
      lang={lang}
      style={{ textAutospace: "normal" as const }}
    >
      {lines.map((line, i) => (
        <tspan key={i} x="50%" dy={i ? "1.3em" : undefined}>{line}</tspan>
      ))}
    </text>
  )

  if (si <= 0)
    return textEl

  return (
    <>
      {si > 0 && (
        <text
          x="50%"
          y="0.5em"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={fontFamily}
          fontSize={`${style.fontScale / 100}em`}
          fontWeight={style.fontWeight}
          fill={style.color}
          stroke="none"
          direction={dir}
          filter={`url(#shadow-${filterId})`}
          lang={lang}
          style={{ textAutospace: "normal" as const }}
        >
          {lines.map((line, i) => (
            <tspan key={i} x="50%" dy={i ? "1.3em" : undefined}>{line}</tspan>
          ))}
        </text>
      )}
      {textEl}
    </>
  )
})

// ---- SubtitlesPair (layout + backgrounds + SubtitleLine) ----

export function SubtitlesPair({
  mainText, mainStyle,
  translationText, translationStyle,
  showMain, showTranslation,
  translationAbove, backgroundOpacity,
  lineGap = 0,
  backgroundStyle = "solid",
  backgroundForceMerge,
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
  backgroundStyle?: BackgroundStyle
  backgroundForceMerge?: boolean
  dir?: string
  lang?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [{ containerWidth, baseFontSize }, setLayout] = useState({ containerWidth: 0, baseFontSize: 16 })

  useEffect(() => {
    const el = containerRef.current
    if (!el)
      return
    const update = () => {
      setLayout({
        containerWidth: el.clientWidth,
        baseFontSize: Number.parseFloat(getComputedStyle(el).fontSize) || 16,
      })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Build ordered display items
  const items = useMemo(() => {
    const result: { text: string, style: SubtitleTextStyle, key: string }[] = []
    if (showMain && showTranslation) {
      if (translationAbove) {
        result.push({ text: translationText, style: translationStyle, key: "t" })
        result.push({ text: mainText, style: mainStyle, key: "m" })
      }
      else {
        result.push({ text: mainText, style: mainStyle, key: "m" })
        result.push({ text: translationText, style: translationStyle, key: "t" })
      }
    }
    else if (showMain) {
      result.push({ text: mainText, style: mainStyle, key: "m" })
    }
    else if (showTranslation) {
      result.push({ text: translationText, style: translationStyle, key: "t" })
    }
    return result
  }, [mainText, mainStyle, translationText, translationStyle, showMain, showTranslation, translationAbove])

  // Wrap text and compute metrics per item
  const layoutData = useMemo(() => {
    if (containerWidth <= 0) {
      return items.map(item => ({
        key: item.key,
        lines: item.text ? [item.text] : [],
        style: item.style,
        fontSizePx: 0,
        maxLineWidth: 0,
        svgHeightPx: 0,
      }))
    }

    return items.map((item) => {
      const fontFamily = SUBTITLE_FONT_FAMILIES[item.style.fontFamily] || SUBTITLE_FONT_FAMILIES.system
      const fs = item.style.fontScale / 100
      const fontSizePx = baseFontSize * fs
      const availableWidth = containerWidth - 32
      const measureWidth = (s: string) => measureTextWidth(s, fontFamily, item.style.fontWeight, fontSizePx)
      const lines = item.text ? wrapText(item.text, measureWidth, Math.max(availableWidth, 1)) : []
      const lineWidths = lines.map(l => measureWidth(l))
      const maxLineWidth = Math.max(...lineWidths)
      const svgHeightPx = fontSizePx * (1.0 + (lines.length - 1) * 1.3)
      return { key: item.key, lines, style: item.style, fontSizePx, maxLineWidth, svgHeightPx }
    })
  }, [items, containerWidth, baseFontSize])

  // Compute background rects
  const backgrounds = useMemo(() => {
    if (!backgroundOpacity || backgroundStyle === "none" || containerWidth <= 0)
      return []

    const makeRect = (data: typeof layoutData[number], yTop: number) => {
      const { pad, wPad } = getBgPad(data.style.fontShadowIntensity, data.style.fontStrokeWidth)
      const bw = data.maxLineWidth + wPad * 2
      return {
        key: `bg-${data.key}`,
        left: (containerWidth - bw) / 2,
        top: yTop - pad,
        width: bw,
        height: data.svgHeightPx + pad * 2 + 2,
        borderRadius: Math.round(data.fontSizePx * 0.8),
      }
    }

    const shouldMerge = layoutData.length === 2 && (lineGap <= 3 || backgroundForceMerge)

    if (shouldMerge) {
      const first = makeRect(layoutData[0], 0)
      const secondTop = layoutData[0].svgHeightPx + lineGap
      const second = makeRect(layoutData[1], secondTop)
      const l = Math.min(first.left, second.left)
      const r = Math.max(first.left + first.width, second.left + second.width)
      return [{
        key: "bg-merged",
        left: l,
        top: Math.min(first.top, second.top),
        width: r - l,
        height: Math.max(first.top + first.height, second.top + second.height) - Math.min(first.top, second.top),
        borderRadius: Math.max(first.borderRadius, second.borderRadius),
      }]
    }

    const rects: { key: string, left: number, top: number, width: number, height: number, borderRadius: number }[] = []
    let y = 0
    for (let i = 0; i < layoutData.length; i++) {
      rects.push(makeRect(layoutData[i], y))
      y += layoutData[i].svgHeightPx
      if (i === 0 && layoutData.length === 2)
        y += lineGap
    }
    return rects
  }, [layoutData, backgroundOpacity, backgroundStyle, containerWidth, lineGap, backgroundForceMerge])

  // Compute total SVG height
  const svgTotalHeight = useMemo(() => {
    if (layoutData.length === 0)
      return 0
    let h = 0
    for (let i = 0; i < layoutData.length; i++) {
      h += layoutData[i].svgHeightPx
      if (i === 0 && layoutData.length === 2)
        h += lineGap
    }
    return h
  }, [layoutData, lineGap])

  // Compute item vertical offsets
  const yOffsets = useMemo(() => {
    const offsets: number[] = []
    let y = 0
    for (let i = 0; i < layoutData.length; i++) {
      offsets.push(y)
      y += layoutData[i].svgHeightPx
      if (i === 0 && layoutData.length === 2)
        y += lineGap
    }
    return offsets
  }, [layoutData, lineGap])

  // Background style helpers
  const bgIsNone = !backgroundOpacity || backgroundStyle === "none"
  const bgIsSolid = backgroundStyle === "solid"
  const bgIsBlur = backgroundStyle === "blur"

  function bgStyle(box: { left: number, top: number, width: number, height: number, borderRadius: number }): React.CSSProperties {
    const op = (backgroundOpacity ?? 0) / 100
    const base: React.CSSProperties = {
      position: "absolute",
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
      borderRadius: box.borderRadius,
      pointerEvents: "none",
      zIndex: 0,
    }
    if (bgIsNone)
      return { ...base, display: "none" }
    if (bgIsSolid)
      return { ...base, backgroundColor: `rgba(0,0,0,${op.toFixed(2)})`, boxShadow: "0 4px 12px rgba(0,0,0,0.35)" }
    if (bgIsBlur) {
      return {
        ...base,
        backgroundColor: `rgba(0,0,0,${op.toFixed(2)})`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
      }
    }
    return {
      ...base,
      backgroundColor: `rgba(255,255,255,${(op * 0.3).toFixed(2)})`,
      backdropFilter: "blur(24px) saturate(1.5)",
      WebkitBackdropFilter: "blur(24px) saturate(1.5)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 12px rgba(0,0,0,0.35)",
    }
  }

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", position: "relative" }}>
      {!bgIsNone && backgrounds.map(box => (
        <div key={box.key} style={bgStyle(box)} />
      ))}
      <svg
        width="100%"
        height={`${svgTotalHeight}px`}
        style={{ display: "block", overflow: "visible", position: "relative", zIndex: 1, pointerEvents: "auto", userSelect: "text" }}
      >
        <defs>
          {layoutData.map(item => (
            <ShadowFilter key={item.key} si={item.style.fontShadowIntensity} id={`shadow-${item.key}`} />
          ))}
        </defs>
        {layoutData.map((item, i) => (
          <g key={item.key} transform={`translate(0, ${yOffsets[i]})`}>
            <SubtitleLine
              lines={item.lines}
              style={item.style}
              filterId={item.key}
              dir={item.key === "t" ? dir : undefined}
              lang={item.key === "t" ? lang : undefined}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}
