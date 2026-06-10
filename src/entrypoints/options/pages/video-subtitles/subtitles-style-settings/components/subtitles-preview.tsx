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
  const { displayMode, translationPosition, lineGap, backgroundForceMerge, container } = style

  const [index, setIndex] = useState(0)
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
      setIndex(prev => (prev + 1) % activeSamples.length)
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
      <div className="relative w-full h-80 rounded-lg overflow-hidden select-none bg-black">
        <canvas ref={canvasRef} className="absolute inset-0 size-full" />

        <div className="absolute inset-0 flex items-center justify-center z-10">
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
              backgroundForceMerge={backgroundForceMerge}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
