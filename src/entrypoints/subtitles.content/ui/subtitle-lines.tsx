import type { ReactNode } from "react"
import type { BackgroundStyle, SubtitleTextStyle } from "@/types/config/subtitles"
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react"
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

interface Box2D { x: number, y: number, w: number, h: number }

function MergedBackground({ boxes, radius, backgroundStyle, backgroundOpacity }: {
  boxes: Box2D[]
  radius: number
  backgroundStyle: BackgroundStyle
  backgroundOpacity: number
}) {
  if (boxes.length < 2 || backgroundStyle === "none")
    return null

  const [b1, b2] = boxes
  const l = Math.min(b1.x, b2.x)
  const rEdge = Math.max(b1.x + b1.w, b2.x + b2.w)
  const top = b1.y
  const bottom = b2.y + b2.h
  const r = radius
  const isGlass = backgroundStyle !== "solid"
  const op = backgroundOpacity / 100

  return (
    <div
      style={{
        position: "absolute",
        left: `${l}px`,
        top: `${top}px`,
        width: `${rEdge - l}px`,
        height: `${bottom - top}px`,
        borderRadius: `${r}px`,
        pointerEvents: "none",
        zIndex: 0,
        ...(isGlass
          ? {
              backgroundColor: backgroundStyle === "blur"
                ? `rgba(0,0,0,${(op * 0.3).toFixed(2)})`
                : "rgba(255,255,255,0.08)",
              backdropFilter: backgroundStyle === "blur"
                ? "blur(12px)"
                : "blur(24px) saturate(1.5)",
              WebkitBackdropFilter: backgroundStyle === "blur"
                ? "blur(12px)"
                : "blur(24px) saturate(1.5)",
              ...(backgroundStyle === "liquid-glass"
                ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 12px rgba(0,0,0,0.1)" }
                : {}),
            }
          : { backgroundColor: `rgba(0,0,0,${(backgroundOpacity / 100).toFixed(2)})` }),
      }}
    />
  )
}

function SubtitleLine({ text, style, backgroundOpacity, backgroundStyle, dir, lang, glass = true, onBBoxReady, lineKey }: {
  text: string
  style: SubtitleTextStyle
  backgroundOpacity?: number
  backgroundStyle?: BackgroundStyle
  dir?: string
  lang?: string
  glass?: boolean
  onBBoxReady?: (key: string, box: Box2D) => void
  lineKey?: string
}) {
  const shadowId = useId()
  const glassRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<SVGTextElement>(null)
  const divRef = useRef<HTMLDivElement>(null)
  const si = style.fontShadowIntensity
  const sw = style.fontStrokeWidth
  const hasStroke = sw > 0
  const lines = text.split("\n")
  const fontFamily = SUBTITLE_FONT_FAMILIES[style.fontFamily] || SUBTITLE_FONT_FAMILIES.system
  const bboxRef = useRef<Box2D | null>(null)

  useLayoutEffect(() => {
    const textEl = textRef.current
    const div = divRef.current
    if (!textEl || !div || !backgroundOpacity)
      return
    const box = textEl.getBBox()
    const shadowPad = si > 0 ? Math.max(1, si * 0.5) + si : 0
    const strokePad = sw / 2
    const pad = Math.max(shadowPad, strokePad, 0)
    const wPad = pad + 6
    const padded: Box2D = { x: box.x - wPad, y: box.y - pad, w: box.width + wPad * 2, h: box.height + pad * 2 }

    const prev = bboxRef.current
    if (prev && prev.x === padded.x && prev.y === padded.y && prev.w === padded.w && prev.h === padded.h)
      return
    bboxRef.current = padded

    if (onBBoxReady && lineKey)
      onBBoxReady(lineKey, { x: padded.x + div.offsetLeft, y: padded.y + div.offsetTop, w: padded.w, h: padded.h })

    if (glass) {
      const g = glassRef.current
      if (!g)
        return
      g.style.left = `${padded.x}px`
      g.style.top = `${padded.y}px`
      g.style.width = `${padded.w}px`
      g.style.height = `${padded.h}px`
    }
  })

  return (
    <div ref={divRef} style={{ position: "relative" }}>
      {glass && !!backgroundOpacity && backgroundStyle !== "solid" && backgroundStyle !== "none" && (
        <div
          ref={glassRef}
          style={{
            position: "absolute",
            borderRadius: "15px",
            pointerEvents: "none",
            zIndex: 0,
            ...(backgroundStyle === "blur"
              ? {
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  backgroundColor: `rgba(0,0,0,${(backgroundOpacity / 100 * 0.3).toFixed(2)})`,
                }
              : {
                  backdropFilter: "blur(24px) saturate(1.5)",
                  WebkitBackdropFilter: "blur(24px) saturate(1.5)",
                  background: "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 12px rgba(0,0,0,0.1)",
                }),
          }}
        />
      )}
      {glass && !!backgroundOpacity && backgroundStyle === "solid" && (
        <div
          ref={glassRef}
          style={{
            position: "absolute",
            borderRadius: "15px",
            pointerEvents: "none",
            zIndex: 0,
            backgroundColor: `rgba(0,0,0,${(backgroundOpacity / 100).toFixed(2)})`,
          }}
        />
      )}
      <svg
        width="100%"
        height={`${1.5 + (lines.length - 1) * 1.3}em`}
        style={{ display: "block", overflow: "visible", position: "relative", zIndex: 1, pointerEvents: "auto", userSelect: "text" }}
      >
        <defs>
          <ShadowFilter si={si} id={`shadow-${shadowId}`} />
        </defs>
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
            direction={dir === "rtl" ? "rtl" : undefined}
            lang={lang}
            style={{ textAutospace: "normal" as const }}
          >
            {text}
          </text>
        )}
        <text
          ref={textRef}
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
          style={{ textAutospace: "normal" as const }}
        >
          {lines.map((line, i) => (
            <tspan key={line} x="50%" dy={i ? "1.3em" : undefined}>
              {line}
            </tspan>
          ))}
        </text>
      </svg>
    </div>
  )
}

export function SubtitlesPair({
  mainText, mainStyle,
  translationText, translationStyle,
  showMain, showTranslation,
  translationAbove, backgroundOpacity,
  lineGap = 0,
  backgroundStyle = "solid",
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
  dir?: string
  lang?: string
}) {
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

  const [boxes, setBoxes] = useState<Record<string, Box2D>>({})
  const mergeReady = items.length === 2 && lineGap <= 3 && Object.keys(boxes).length === 2 && !!backgroundOpacity && backgroundStyle !== "none"

  const handleBBoxReady = useCallback((key: string, box: Box2D) => {
    setBoxes((prev: Record<string, Box2D>) => {
      const existing = prev[key]
      if (existing && existing.x === box.x && existing.y === box.y && existing.w === box.w && existing.h === box.h)
        return prev
      return { ...prev, [key]: box }
    })
  }, [])

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", position: "relative" }}>
      {mergeReady && (
        <MergedBackground
          boxes={items.map(item => boxes[item.key])}
          radius={15}
          backgroundStyle={backgroundStyle}
          backgroundOpacity={backgroundOpacity ?? 0}
        />
      )}
      {items.map((item, i) => (
        <div key={item.key} style={i === 1 ? { marginTop: `${lineGap}px` } : undefined}>
          <SubtitleLine
            text={item.text}
            style={item.style}
            backgroundOpacity={backgroundOpacity}
            backgroundStyle={backgroundStyle}
            glass={!mergeReady}
            onBBoxReady={handleBBoxReady}
            lineKey={item.key}
            dir={item.key === "t" ? dir : undefined}
            lang={item.key === "t" ? lang : undefined}
          />
        </div>
      ))}
    </div>
  )
}
