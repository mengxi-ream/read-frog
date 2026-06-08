import { useAtomValue } from "jotai"
import { useEffect, useMemo, useRef, useState } from "react"
import { i18n } from "#imports"
import { Label } from "@/components/ui/base-ui/label"
import { SubtitlesPair } from "@/entrypoints/subtitles.content/ui/subtitle-lines"
import { configFieldsAtomMap } from "@/utils/atoms/config"

// ---- Test card grid ----

const GRID: string[][] = [
  ["#FFFFFF", "#E0E0E0", "#C0C0C0", "#A0A0A0", "#808080", "#606060"],
  ["#404040", "#202020", "#000000", "#FF0000", "#00CC00", "#0044FF"],
  ["#FFDD00", "#00CCCC", "#FF00AA", "#FF8800", "#CC0044", "#006644"],
  ["#4400CC", "#884400", "#FF4488", "#CCFFCC", "#CCCCFF", "#FFEECC"],
]

const COLS = 6
const ROWS = 4

// ---- WCAG contrast helpers ----

function srgbToLinear(c: number): number {
  c /= 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function calcContrastRatio(bgHex: string): number {
  const L1 = 1
  const L2 = relativeLuminance(bgHex)
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
}

// ---- Sample grid color at canvas point ----

function sampleGridColor(
  x: number, y: number,
  ox: number, oy: number,
  tileSize: number,
): string {
  const vc = Math.floor((x + ox) / tileSize)
  const vr = Math.floor((y + oy) / tileSize)
  const col = ((vc % COLS) + COLS) % COLS
  const row = ((vr % ROWS) + ROWS) % ROWS
  return GRID[row][col]
}

// ---- Draw helpers ----

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// ---- Draw one frame ----

function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const tileSize = Math.ceil(Math.max(w, h) / 6)
  const gridW = COLS * tileSize
  const gridH = ROWS * tileSize

  const ox = (t * 120) % gridW
  const oy = (t * 40) % gridH

  // Draw visible tiles
  const colsNeeded = Math.ceil(w / tileSize) + 3
  const rowsNeeded = Math.ceil(h / tileSize) + 3

  for (let rowOff = -1; rowOff < rowsNeeded; rowOff++) {
    for (let colOff = -1; colOff < colsNeeded; colOff++) {
      const px = colOff * tileSize - (ox % tileSize)
      const py = rowOff * tileSize - (oy % tileSize)
      const vc = Math.floor((px + ox) / tileSize)
      const vr = Math.floor((py + oy) / tileSize)
      const col = ((vc % COLS) + COLS) % COLS
      const row = ((vr % ROWS) + ROWS) % ROWS
      ctx.fillStyle = GRID[row][col]
      ctx.fillRect(px, py, tileSize + 1, tileSize + 1)
    }
  }

  // Contrast overlay at subtitle position (bottom-center ≈ h * 0.82)
  const sx = w * 0.5
  const sy = h * 0.82
  const bgHex = sampleGridColor(sx, sy, ox, oy, tileSize)
  const cr = calcContrastRatio(bgHex)
  const pass = cr >= 4.5
  const label = `${bgHex}  CR ${cr.toFixed(1)}  ${pass ? "✓" : "✗"}`

  ctx.save()
  ctx.fillStyle = "rgba(0,0,0,0.7)"
  roundRect(ctx, w - 178, 10, 168, 24, 6)
  ctx.fill()
  ctx.fillStyle = pass ? "#8f8" : "#f88"
  ctx.font = "12px monospace"
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  ctx.fillText(label, w - 14, 22)
  ctx.restore()
}

// ---- Tab/loading idle detection ----

let tabActive = true
function onVisibility() {
  tabActive = !document.hidden
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", onVisibility)
}

// ---- Constants ----

const SAMPLES = [
  // Japanese
  { original: "Run!", translation: "走れ！" },
  { original: "As long as you don't give up, there is always a way.", translation: "諦めない限り、道は必ずある。" },
  { original: "Man becomes great through thought. When he stops thinking, man ends.", translation: "人間は考えることによって偉大になる。考えることをやめたとき、人間は終わる。" },
  { original: "Life is only once, not twice. That's why we must cherish every moment. Have the courage to believe in your own path and move forward without regret.", translation: "人生は一度きり、二度はない。だからこそ、一瞬一瞬を大切に生きなければならない。後悔のないように、自分自身の道を信じて進む勇気を持とう。" },
  // Korean
  { original: "Thank you.", translation: "감사합니다." },
  { original: "What do you mean?", translation: "무슨 뜻이야?" },
  { original: "No matter how dark the night, the stars still shine. No matter how hard the day, hope remains.", translation: "아무리 어두운 밤이어도 별은 빛나고, 아무리 힘든 날이어도 희망은 있다." },
  { original: "Life is short, art is long. Opportunity passes quickly, experience can deceive, and judgment is difficult. Therefore, we must make the most of every moment.", translation: "인생은 짧고 예술은 길다. 기회는 빠르게 지나가고 경험은 속일 수 있으며 판단은 어렵다. 따라서 우리는 각 순간을 최대한 활용해야 한다." },
  // Chinese
  { original: "Really?", translation: "真的吗？" },
  { original: "Life is like a journey, and I am but a traveler.", translation: "人生如逆旅，我亦是行人。" },
  { original: "Mr. Kamiya is not fighting against the world, but against things that could make the world take notice.", translation: "神谷先生不是在对抗世界，而是在对抗可能让世界为之侧目的事物。" },
  { original: "Dear friends, let us drink without pause! I will sing for you — listen well. Bells and jade are not worth cherishing; I only wish to be drunk and never wake. All the sages of old are forgotten; only great drinkers leave their names. Prince Chen once feasted at Pingle with ten thousand cups. Why fret over money? Buy more wine! My furs and dappled horse — trade them for wine, and together we'll drown the endless sorrows of ages.", translation: "岑夫子，丹丘生，将进酒，杯莫停。与君歌一曲，请君为我倾耳听。钟鼓馔玉不足贵，但愿长醉不愿醒。古来圣贤皆寂寞，惟有饮者留其名。陈王昔时宴平乐，斗酒十千恣欢谑。主人何为言少钱，径须沽取对君酌。五花马，千金裘，呼儿将出换美酒，与尔同销万古愁。" },
]

const INTERVAL_MS = 4000

const LANG_GROUPS: Record<string, number[]> = {
  jpn: [0, 1, 2, 3],
  kor: [4, 5, 6, 7],
  cmn: [8, 9, 10, 11],
  yue: [8, 9, 10, 11],
}

export function SubtitlesPreview() {
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const { targetCode } = useAtomValue(configFieldsAtomMap.language)
  const { displayMode, translationPosition, lineGap, container } = style

  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const targetRef = useRef(targetCode)

  const activeSamples = useMemo(() => {
    const indices = LANG_GROUPS[targetCode]
    if (!indices)
      return SAMPLES.slice(8, 12)
    return indices.map(i => SAMPLES[i])
  }, [targetCode])

  // Reset index when language changes
  if (targetRef.current !== targetCode) {
    targetRef.current = targetCode
    setIndex(0)
  }

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current!
    if (!canvas)
      return
    const ctx = canvas.getContext("2d")!
    let raf = 0

    function frame() {
      if (!tabActive || !canvas) {
        raf = requestAnimationFrame(frame)
        return
      }

      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        raf = requestAnimationFrame(frame)
        return
      }

      const dpr = window.devicePixelRatio || 1
      const bw = Math.round(rect.width * dpr)
      const bh = Math.round(rect.height * dpr)
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawFrame(ctx, rect.width, rect.height, performance.now() / 1000)

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Carousel timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (!pausedRef.current) {
        setIndex(prev => (prev + 1) % activeSamples.length)
      }
    }, INTERVAL_MS)
    return () => clearInterval(timer)
  }, [activeSamples.length])

  const sample = activeSamples[index]
  const translationAbove = translationPosition === "above"
  const showMain = displayMode !== "translationOnly"
  const showTranslation = displayMode !== "originalOnly"

  return (
    <div className="mb-4">
      <Label className="mb-2 block text-sm font-medium">
        {i18n.t("options.videoSubtitles.style.preview")}
      </Label>
      <div
        className="relative aspect-video w-full rounded-lg overflow-hidden select-none bg-black"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <canvas ref={canvasRef} className="absolute inset-0 size-full" />

        <div className="absolute inset-0 flex items-end justify-center pb-[18%] z-10">
          <div className="w-full max-w-[90%]">
            <SubtitlesPair
              mainText={sample.original}
              mainStyle={style.main}
              translationText={sample.translation}
              translationStyle={style.translation}
              showMain={showMain}
              showTranslation={showTranslation}
              translationAbove={translationAbove}
              backgroundOpacity={container.backgroundOpacity}
              backgroundStyle={container.backgroundStyle}
              lineGap={lineGap}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
