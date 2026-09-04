import type { CSSProperties, HTMLAttributes, Ref, ReactNode } from "react"
import type { SliderValue } from "@/components/ui/base-ui/slider"
import { Menu } from "@base-ui/react/menu"
import { NumberField } from "@base-ui/react/number-field"
import { Popover } from "@base-ui/react/popover"
import { IconChevronDown, IconColorPicker, IconX } from "@tabler/icons-react"
import { AnimatePresence, motion } from "motion/react"
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Slider } from "@/components/ui/base-ui/slider"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/base-ui/tooltip"
import { useProximityHover } from "@/hooks/use-proximity-hover"
import { spring } from "@/utils/styles/springs"
import { cn } from "@/utils/styles/utils"

/**
 * A port of fluidfunctionalism.com/docs/color-picker — a HEX/RGB/HSL/OKLCH picker with an
 * alpha channel, a saturation/brightness square, scrubbable channel inputs, optional preset
 * swatches, and the native eyedropper. Replaces the `<input type="color">` we used for
 * subtitle colours, which gave us the OS picker (unthemed, unreachable from a content
 * script's shadow DOM, and hex-only).
 *
 * Adapted to this codebase in four places, since the source ships against its own design
 * system rather than shadcn tokens:
 *
 *  - **Surfaces.** The source paints popups from an 8-level `bg-surface-N`/`shadow-surface-N`
 *    ladder threaded through a React context. Those utilities don't exist in our theme, so
 *    the panel and the format menu use `bg-popover` + `border` + a shadow directly. Nothing
 *    here nests deeply enough to need the ladder.
 *  - **Shape.** The source reads radii from a pill/rounded shape context. We pin the
 *    `rounded` variant (the one its own popups force anyway) as {@link SHAPE}, mapped onto
 *    our `--radius` scale.
 *  - **Weights.** `fontVariationSettings` tokens become plain Tailwind weight classes —
 *    Inter Variable is only loaded in the extension pages, not in content scripts, and this
 *    component renders in both.
 *
 * The hue and alpha tracks are the exception: our `Slider` is a port of the same registry
 * slider this picker is written against, so they use it directly.
 *
 * Portalled layers (popover, format menu, channel tooltips) all take their container from
 * {@link ColorPickerPortalContainer}. Content scripts must wrap in it — a portal defaulting
 * to `document.body` lands outside the shadow root, where none of our styles reach.
 */

type ColorFormat = "hex" | "rgb" | "hsl" | "oklch"

/**
 * Where portalled layers mount. Consumers set it to a node inside their shadow root;
 * `ColorPickerPopover` re-provides its own panel so the format menu and tooltips track the
 * panel rather than the page.
 */
const ColorPickerPortalContainerContext = createContext<HTMLElement | null>(null)

function ColorPickerPortalContainer({
  value,
  children,
}: {
  value: HTMLElement | null
  children: ReactNode
}) {
  return (
    <ColorPickerPortalContainerContext value={value}>{children}</ColorPickerPortalContainerContext>
  )
}

interface ParsedColor {
  // HSV (canonical, 0..360 / 0..1 / 0..1)
  h: number
  s: number
  v: number
  a: number
  // sRGB 0..255
  r: number
  g: number
  b: number
  // Formatted strings
  hex: string
  rgb: string
  hsl: string
  oklch: string
}

interface ColorPickerProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue"
> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string, parsed: ParsedColor) => void
  format?: ColorFormat
  defaultFormat?: ColorFormat
  onFormatChange?: (format: ColorFormat) => void
  swatches?: string[]
  hideEyedropper?: boolean
  /**
   * Controls the format dropdown's open state. When provided, the dropdown is fully
   * controlled and ignores user toggles.
   */
  formatOpen?: boolean
  /** Initial open state for the format dropdown (uncontrolled). */
  defaultFormatOpen?: boolean
  ref?: Ref<HTMLDivElement>
}

interface ColorPickerPopoverProps extends ColorPickerProps {
  triggerLabel?: string
  triggerLabelPosition?: "left" | "right"
  triggerShowValue?: boolean
  triggerShowRemove?: boolean
  onTriggerRemove?: () => void
  triggerClassName?: string
  /**
   * Controls the popover's open state. When provided, the popover is fully controlled and
   * ignores trigger clicks.
   */
  open?: boolean
  /** Initial open state for the popover (uncontrolled). */
  defaultOpen?: boolean
  /** Called when the open state would change (fires even when controlled). */
  onOpenChange?: (open: boolean) => void
}

interface ColorSwatchProps extends Omit<HTMLAttributes<HTMLButtonElement>, "color"> {
  color: string
  size?: number
  selected?: boolean
  ref?: Ref<HTMLButtonElement>
}

// ---------------------------------------------------------------------------
// Color math (no deps)
// ---------------------------------------------------------------------------

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

function clamp255(n: number) {
  return Math.max(0, Math.min(255, n))
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s
  const hh = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hh % 2) - 1))
  let r = 0
  let g = 0
  let b = 0
  if (hh < 1) {
    r = c
    g = x
  } else if (hh < 2) {
    r = x
    g = c
  } else if (hh < 3) {
    g = c
    b = x
  } else if (hh < 4) {
    g = x
    b = c
  } else if (hh < 5) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  const m = v - c
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const v = max
  const d = max - min
  const s = max === 0 ? 0 : d / max
  let h = 0
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, v }
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d > 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hh = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hh % 2) - 1))
  let r = 0
  let g = 0
  let b = 0
  if (hh < 1) {
    r = c
    g = x
  } else if (hh < 2) {
    r = x
    g = c
  } else if (hh < 3) {
    g = c
    b = x
  } else if (hh < 4) {
    g = x
    b = c
  } else if (hh < 5) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  const m = l - c / 2
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

function srgbToLinear(c: number): number {
  c = c / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
  return clamp01(v) * 255
}

function linearRgbToOklab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const lRoot = Math.cbrt(l)
  const mRoot = Math.cbrt(m)
  const sRoot = Math.cbrt(s)
  return {
    L: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  }
}

function oklabToLinearRgb(L: number, a: number, b: number): { r: number; g: number; b: number } {
  const lRoot = L + 0.3963377774 * a + 0.2158037573 * b
  const mRoot = L - 0.1055613458 * a - 0.0638541728 * b
  const sRoot = L - 0.0894841775 * a - 1.291485548 * b
  const l = lRoot * lRoot * lRoot
  const m = mRoot * mRoot * mRoot
  const s = sRoot * sRoot * sRoot
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  }
}

function rgbToOklch(r: number, g: number, b: number): { L: number; C: number; H: number } {
  const lab = linearRgbToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b))
  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b)
  let H = (Math.atan2(lab.b, lab.a) * 180) / Math.PI
  if (H < 0) H += 360
  return { L: lab.L, C, H }
}

function oklchToRgb(L: number, C: number, H: number): { r: number; g: number; b: number } {
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)
  const lin = oklabToLinearRgb(L, a, b)
  // Out-of-gamut OKLCH is clamped into sRGB silently rather than rejected.
  return {
    r: clamp255(linearToSrgb(lin.r)),
    g: clamp255(linearToSrgb(lin.g)),
    b: clamp255(linearToSrgb(lin.b)),
  }
}

function to2hex(n: number): string {
  return Math.round(clamp255(n)).toString(16).padStart(2, "0")
}

function rgbToHexStr(r: number, g: number, b: number, a: number): string {
  if (a >= 1) return `#${to2hex(r)}${to2hex(g)}${to2hex(b)}`
  return `#${to2hex(r)}${to2hex(g)}${to2hex(b)}${to2hex(a * 255)}`
}

function expandShortHex(h: string): string {
  if (h.length === 3 || h.length === 4) {
    return h
      .split("")
      .map((c) => c + c)
      .join("")
  }
  return h
}

function parseHex(input: string): { r: number; g: number; b: number; a: number } | null {
  const m = input.trim().match(/^#?([0-9a-f]{3,8})$/i)
  if (!m?.[1]) return null
  const h = expandShortHex(m[1])
  if (h.length === 6) {
    return {
      r: Number.parseInt(h.slice(0, 2), 16),
      g: Number.parseInt(h.slice(2, 4), 16),
      b: Number.parseInt(h.slice(4, 6), 16),
      a: 1,
    }
  }
  if (h.length === 8) {
    return {
      r: Number.parseInt(h.slice(0, 2), 16),
      g: Number.parseInt(h.slice(2, 4), 16),
      b: Number.parseInt(h.slice(4, 6), 16),
      a: Number.parseInt(h.slice(6, 8), 16) / 255,
    }
  }
  return null
}

function parsePart(part: string): number {
  return part.endsWith("%") ? Number.parseFloat(part) / 100 : Number.parseFloat(part)
}

/**
 * Splits a functional colour's argument list — `rgb(…)`, `hsl(…)`, `oklch(…)` — into its
 * three components plus an optional alpha, accepting both the comma and the slash-separated
 * spellings. Returns null when a component is missing.
 */
function splitParts(body: string): [string, string, string, string | undefined] | null {
  const [first, second, third, alpha] = body.split(/[\s,/]+/).filter(Boolean)
  if (first === undefined || second === undefined || third === undefined) return null
  return [first, second, third, alpha]
}

function parseColor(input: string): { r: number; g: number; b: number; a: number } | null {
  const s = input.trim()
  if (!s) return null
  if (s.startsWith("#") || /^[0-9a-f]{3,8}$/i.test(s)) return parseHex(s)

  const rgbM = s.match(/^rgba?\(\s*([^)]+)\)$/i)
  if (rgbM?.[1]) {
    const parts = splitParts(rgbM[1])
    if (!parts) return null
    const r = Number.parseFloat(parts[0])
    const g = Number.parseFloat(parts[1])
    const b = Number.parseFloat(parts[2])
    const a = parts[3] === undefined ? 1 : parsePart(parts[3])
    if ([r, g, b, a].some(Number.isNaN)) return null
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b), a: clamp01(a) }
  }

  const hslM = s.match(/^hsla?\(\s*([^)]+)\)$/i)
  if (hslM?.[1]) {
    const parts = splitParts(hslM[1])
    if (!parts) return null
    const h = Number.parseFloat(parts[0])
    const sat = parsePart(parts[1])
    const l = parsePart(parts[2])
    const a = parts[3] === undefined ? 1 : parsePart(parts[3])
    if ([h, sat, l, a].some(Number.isNaN)) return null
    const rgb = hslToRgb(h, clamp01(sat), clamp01(l))
    return { r: clamp255(rgb.r), g: clamp255(rgb.g), b: clamp255(rgb.b), a: clamp01(a) }
  }

  const oklchM = s.match(/^oklch\(\s*([^)]+)\)$/i)
  if (oklchM?.[1]) {
    const parts = splitParts(oklchM[1])
    if (!parts) return null
    const L = parsePart(parts[0])
    const C = Number.parseFloat(parts[1])
    const H = Number.parseFloat(parts[2])
    const a = parts[3] === undefined ? 1 : parsePart(parts[3])
    if ([L, C, H, a].some(Number.isNaN)) return null
    const rgb = oklchToRgb(clamp01(L), Math.max(0, C), H)
    return { r: clamp255(rgb.r), g: clamp255(rgb.g), b: clamp255(rgb.b), a: clamp01(a) }
  }

  return null
}

/**
 * Browser-assisted fallback for colours the manual parser doesn't cover — named CSS colours
 * like "red" or "tomato". A canvas 2d context round-trips any valid CSS colour through
 * `fillStyle`, which serialises to something {@link parseColor} understands.
 *
 * Only call from event handlers or effects, never during render.
 */
let cssColorCtx: CanvasRenderingContext2D | null = null

function resolveCssColor(input: string): { r: number; g: number; b: number; a: number } | null {
  const direct = parseColor(input)
  if (direct) return direct
  const s = input.trim()
  if (!s || typeof document === "undefined") return null
  if (!cssColorCtx) {
    cssColorCtx = document.createElement("canvas").getContext("2d")
    if (!cssColorCtx) return null
  }
  const ctx = cssColorCtx
  // An invalid assignment leaves fillStyle untouched, so round-trip from two different
  // starting values to tell rejection apart from a real colour.
  ctx.fillStyle = "#000000"
  ctx.fillStyle = s
  const first = ctx.fillStyle
  ctx.fillStyle = "#ffffff"
  ctx.fillStyle = s
  const second = ctx.fillStyle
  if (first !== second) return null
  return parseColor(first)
}

function buildParsed(h: number, s: number, v: number, a: number): ParsedColor {
  const { r, g, b } = hsvToRgb(h, s, v)
  const hsl = rgbToHsl(r, g, b)
  const oklch = rgbToOklch(r, g, b)
  const hex = rgbToHexStr(r, g, b, a)
  const rgbStr =
    a >= 1
      ? `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
      : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(a.toFixed(3))})`
  const hslStr =
    a >= 1
      ? `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%)`
      : `hsla(${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%, ${Number(a.toFixed(3))})`
  const oklchStr =
    a >= 1
      ? `oklch(${(oklch.L * 100).toFixed(1)}% ${oklch.C.toFixed(3)} ${oklch.H.toFixed(1)})`
      : `oklch(${(oklch.L * 100).toFixed(1)}% ${oklch.C.toFixed(3)} ${oklch.H.toFixed(1)} / ${Number(a.toFixed(3))})`
  return {
    h,
    s,
    v,
    a,
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b),
    hex,
    rgb: rgbStr,
    hsl: hslStr,
    oklch: oklchStr,
  }
}

function formatValueByFormat(parsed: ParsedColor, fmt: ColorFormat): string {
  switch (fmt) {
    case "rgb":
      return parsed.rgb
    case "hsl":
      return parsed.hsl
    case "oklch":
      return parsed.oklch
    case "hex":
    default:
      return parsed.hex
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANEL_WIDTH = 280
const SQUARE_HEIGHT = 156

/**
 * The source's `rounded` shape variant, mapped onto our `--radius` scale. Its own popups
 * pin this variant regardless of the ambient shape, so nothing is lost by fixing it.
 */
const SHAPE = {
  item: "rounded-lg",
  bg: "rounded-lg",
  /** +2px over `item`: the focus ring sits 2px outside the element, so this keeps corners concentric. */
  focusRing: "rounded-[10px]",
  container: "rounded-xl",
  input: "rounded-lg",
} as const

/**
 * Alpha checkerboard. Half-transparent grey over whatever sits behind it, rather than the
 * source's two opaque `--checker-*` tokens — that way one value reads correctly on both the
 * light and dark panel without adding theme tokens.
 */
const CHECKER_A = "rgba(127,127,127,0.32)"
const CHECKER_BG: CSSProperties = {
  backgroundImage: `conic-gradient(${CHECKER_A} 0 25%, transparent 0 50%, ${CHECKER_A} 0 75%, transparent 0)`,
  backgroundSize: "8px 8px",
}

/** Hover and selected fills for the format menu, matching `fluid-card`'s stacking tints. */
const HOVER_TINT = "bg-foreground/[0.045]"
const SELECTED_TINT = "bg-foreground/[0.09]"

const CONTROL_CLASS =
  "h-9 bg-transparent transition-colors duration-75 outline-none focus-visible:ring-1 focus-visible:ring-ring"

// ---------------------------------------------------------------------------
// SaturationSquare
// ---------------------------------------------------------------------------

interface SaturationSquareProps {
  h: number
  s: number
  v: number
  onChange: (s: number, v: number) => void
}

function SaturationSquare({ h, s, v, onChange }: SaturationSquareProps) {
  const ref = useRef<HTMLDivElement>(null)
  // State, not a ref: this gates the ghost hover cursor during render, and a ref mutation
  // wouldn't re-render, leaving the ghost stuck on screen.
  const [dragging, setDragging] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return
      const x = clamp01((clientX - rect.left) / rect.width)
      const y = clamp01((clientY - rect.top) / rect.height)
      onChange(x, 1 - y)
    },
    [onChange],
  )

  const updateCursorPos = useCallback((clientX: number, clientY: number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    setCursorPos({
      x: clamp01((clientX - rect.left) / rect.width) * 100,
      y: clamp01((clientY - rect.top) / rect.height) * 100,
    })
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return
      e.preventDefault()
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
      updateFromPointer(e.clientX, e.clientY)
    },
    [updateFromPointer],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      updateCursorPos(e.clientX, e.clientY)
      if (!dragging) return
      updateFromPointer(e.clientX, e.clientY)
    },
    [dragging, updateFromPointer, updateCursorPos],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 0.1 : 0.01
      let nextS = s
      let nextV = v
      let handled = true
      if (e.key === "ArrowLeft") nextS = clamp01(s - step)
      else if (e.key === "ArrowRight") nextS = clamp01(s + step)
      else if (e.key === "ArrowUp") nextV = clamp01(v + step)
      else if (e.key === "ArrowDown") nextV = clamp01(v - step)
      else handled = false
      if (handled) {
        e.preventDefault()
        onChange(nextS, nextV)
      }
    },
    [onChange, s, v],
  )

  const { r, g, b } = hsvToRgb(h, s, v)
  const thumbColor = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`

  return (
    <div
      ref={ref}
      role="application"
      aria-label="Saturation and brightness"
      tabIndex={0}
      onFocus={(e) => {
        if (e.currentTarget.matches(":focus-visible")) setFocused(true)
      }}
      onBlur={() => setFocused(false)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false)
        setCursorPos(null)
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDragging(false)}
      onKeyDown={onKeyDown}
      className={cn(
        "relative w-full cursor-none touch-none outline-none select-none",
        SHAPE.bg,
        focused && "ring-2 ring-ring",
      )}
      style={{ height: SQUARE_HEIGHT }}
    >
      <div
        className={cn("absolute inset-0 overflow-hidden", SHAPE.bg)}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h}, 100%, 50%))`,
        }}
      />
      <motion.div
        className="pointer-events-none absolute rounded-full"
        initial={false}
        animate={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, width: 18, height: 18 }}
        transition={{ duration: 0 }}
        style={{
          transform: "translate(-50%, -50%)",
          border: "1px solid white",
          boxShadow: "0 0 0 1px rgba(0,0,0,1)",
          backgroundColor: thumbColor,
        }}
      />
      {hovered && !dragging && cursorPos && (
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${cursorPos.x}%`,
            top: `${cursorPos.y}%`,
            width: 18,
            height: 18,
            transform: "translate(-50%, -50%)",
            border: "2px solid rgba(255, 255, 255, 0.55)",
            boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.2)",
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hue and alpha tracks
//
// Both are our own `Slider` — the same component the source's picker is written against —
// with the fill hidden, since on a gradient track the filled portion carries no meaning.
// The track draws a border by default, which each gradient turns off so the colour runs
// edge to edge.
// ---------------------------------------------------------------------------

function toSingle(value: SliderValue): number {
  return typeof value === "number" ? value : value[0]
}

function HueSlider({ h, onChange }: { h: number; onChange: (h: number) => void }) {
  return (
    <Slider
      value={h}
      onChange={(v) => onChange(toSingle(v))}
      min={0}
      max={360}
      step={1}
      showValue={false}
      hideFill
      thumbColor={`hsl(${h}, 100%, 50%)`}
      thumbBorderColor="rgba(255,255,255,0.9)"
      aria-label="Hue"
      trackStyle={{
        background:
          "linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))",
        borderColor: "transparent",
      }}
    />
  )
}

function AlphaSlider({
  a,
  solidColor,
  solidR,
  solidG,
  solidB,
  onChange,
}: {
  a: number
  solidColor: string
  solidR: number
  solidG: number
  solidB: number
  onChange: (a: number) => void
}) {
  // A colour-aware transparent stop (same channels, alpha 0) keeps the gradient
  // chromatically consistent and reaches fully opaque with no edge gap.
  const transparentColor = `rgba(${solidR}, ${solidG}, ${solidB}, 0)`
  return (
    <Slider
      value={Math.round(a * 100)}
      onChange={(v) => onChange(toSingle(v) / 100)}
      min={0}
      max={100}
      step={1}
      showValue={false}
      hideFill
      thumbColor={solidColor}
      thumbBorderColor="rgba(255,255,255,0.9)"
      aria-label="Alpha"
      trackStyle={{
        backgroundImage: `linear-gradient(to right, ${transparentColor} 0%, ${solidColor} 98%), ${CHECKER_BG.backgroundImage}`,
        backgroundSize: `100% 100%, ${CHECKER_BG.backgroundSize}`,
        borderWidth: 0,
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// FormatDropdown
//
// Base UI's Menu owns trigger wiring, positioning, dismissal, roving highlight and
// typeahead; RadioGroup/RadioItem carry the radio semantics. This layer adds the
// proximity-hover overlays and the spring open/close animation, releasing Base UI's
// deferred unmount only once the exit tween has played (same pattern as select.tsx).
// ---------------------------------------------------------------------------

const FORMAT_LABELS: Record<ColorFormat, string> = {
  hex: "HEX",
  rgb: "RGB",
  hsl: "HSL",
  oklch: "OKLCH",
}

const FORMATS = ["hex", "rgb", "hsl", "oklch"] as const

interface FormatMenuContextValue {
  registerItem: (index: number, element: HTMLElement | null) => void
  activeIndex: number | null
  checkedIndex?: number
}

const FormatMenuContext = createContext<FormatMenuContextValue | null>(null)

function FormatItem({
  index,
  value,
  label,
  checked,
}: {
  index: number
  value: ColorFormat
  label: string
  checked: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const menuCtx = use(FormatMenuContext)

  useEffect(() => {
    menuCtx?.registerItem(index, ref.current)
    return () => menuCtx?.registerItem(index, null)
  }, [index, menuCtx])

  const isActive = menuCtx?.activeIndex === index

  return (
    <Menu.RadioItem
      value={value}
      label={label}
      closeOnClick
      render={
        <div
          ref={ref}
          data-proximity-index={index}
          className={cn(
            "relative z-10 flex cursor-pointer items-center px-3 py-2 text-[13px] outline-none",
            SHAPE.item,
          )}
        />
      }
    >
      {/* The bold copy is rendered invisibly underneath so the row keeps one width across
          weight changes, instead of nudging its neighbours when selection moves. */}
      <span className="inline-grid">
        <span className="invisible col-start-1 row-start-1 font-semibold" aria-hidden="true">
          {label}
        </span>
        <span
          className={cn(
            "col-start-1 row-start-1 transition-colors duration-75",
            checked ? "font-semibold" : "font-normal",
            isActive || checked ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
      </span>
    </Menu.RadioItem>
  )
}

function FormatDropdown({
  value,
  onChange,
  open: openProp,
  defaultOpen = false,
}: {
  value: ColorFormat
  onChange: (f: ColorFormat) => void
  open?: boolean
  defaultOpen?: boolean
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen
  const actionsRef = useRef<{ unmount: () => void; close: () => void }>(null)
  const portalContainer = use(ColorPickerPortalContainerContext)
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    activeIndex,
    setActiveIndex,
    itemRects,
    sessionRef,
    handlers,
    registerItem,
    measureItems,
  } = useProximityHover(containerRef)

  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

  // Release Base UI's deferred unmount once the exit tween has played. onAnimationComplete
  // is the primary signal; this timeout is the fallback for throttled tabs where rAF-driven
  // animation callbacks stall (spring.fast.exit is 60ms — 120ms covers it with margin).
  useEffect(() => {
    if (open) return undefined
    const id = setTimeout(() => actionsRef.current?.unmount(), 120)
    return () => clearTimeout(id)
  }, [open])

  // Measure once the popup has mounted: first frame waits for React's commit, second for layout.
  useEffect(() => {
    if (!open) return undefined
    let inner: number
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => measureItems())
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [open, measureItems])

  const checkedIndex = FORMATS.indexOf(value)
  const activeRect = activeIndex !== null ? itemRects[activeIndex] : null
  const checkedRect = checkedIndex !== -1 ? itemRects[checkedIndex] : null
  const focusRect = focusedIndex !== null ? itemRects[focusedIndex] : null
  const menuCtx = useMemo(
    () => ({ registerItem, activeIndex, checkedIndex }),
    [registerItem, activeIndex, checkedIndex],
  )

  return (
    <Menu.Root
      open={open}
      onOpenChange={(next) => {
        if (!isControlled) setInternalOpen(next)
      }}
      actionsRef={actionsRef}
      // Non-modal: the page keeps scrolling and the Positioner tracks the anchor, so the
      // popup follows its trigger instead of detaching.
      modal={false}
    >
      <Menu.Trigger
        className={cn(
          "flex cursor-pointer items-center justify-between gap-2 px-3 text-[13px] font-medium hover:bg-accent hover:text-foreground",
          CONTROL_CLASS,
          SHAPE.input,
          open ? "bg-accent text-foreground" : "text-muted-foreground active:bg-accent",
        )}
      >
        <span>{FORMAT_LABELS[value]}</span>
        <IconChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </Menu.Trigger>
      <Menu.Portal container={portalContainer ?? undefined}>
        {/* pointer-events-auto: content-script hosts are click-through at the root so the
            page stays usable, and a portalled layer has to opt back in to receive events. */}
        <Menu.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          className="pointer-events-auto z-60 outline-none"
        >
          <motion.div
            initial={{ opacity: 0, y: -4, scaleY: 0.96 }}
            animate={open ? { opacity: 1, y: 0, scaleY: 1 } : { opacity: 0, y: -4, scaleY: 0.96 }}
            transition={open ? spring.fast : spring.fast.exit}
            style={{ transformOrigin: "top center" }}
            onAnimationComplete={() => {
              if (!open) actionsRef.current?.unmount()
            }}
          >
            <FormatMenuContext value={menuCtx}>
              <Menu.Popup
                ref={containerRef}
                data-slot="color-picker-format-content"
                onMouseEnter={() => {
                  handlers.onMouseEnter()
                  setFocusedIndex(null)
                }}
                onMouseMove={handlers.onMouseMove}
                onMouseLeave={handlers.onMouseLeave}
                onFocus={(e) => {
                  const indexAttr = (e.target as HTMLElement)
                    .closest("[data-proximity-index]")
                    ?.getAttribute("data-proximity-index")
                  // Index 0 is falsy, so this has to be an explicit nullish check.
                  if (indexAttr === null || indexAttr === undefined) return
                  const idx = Number(indexAttr)
                  setActiveIndex(idx)
                  setFocusedIndex((e.target as HTMLElement).matches(":focus-visible") ? idx : null)
                }}
                onBlur={(e) => {
                  if (containerRef.current?.contains(e.relatedTarget)) return
                  setFocusedIndex(null)
                  setActiveIndex(null)
                }}
                className={cn(
                  "relative flex min-w-[var(--anchor-width)] flex-col gap-0.5 border bg-popover p-1 shadow-md outline-none select-none",
                  SHAPE.container,
                )}
              >
                {/* Selected background */}
                <AnimatePresence>
                  {checkedRect && (
                    <motion.div
                      className={cn("pointer-events-none absolute", SHAPE.bg, SELECTED_TINT)}
                      initial={false}
                      animate={{
                        top: checkedRect.top,
                        left: checkedRect.left,
                        width: checkedRect.width,
                        height: checkedRect.height,
                        opacity: 1,
                      }}
                      exit={{ opacity: 0, transition: spring.moderate.exit }}
                      transition={{ ...spring.moderate, opacity: { duration: 0.08 } }}
                    />
                  )}
                </AnimatePresence>

                {/* Hover background — keyed per pointer session so it fades in at the
                    selected row rather than sliding from wherever it last sat. */}
                <AnimatePresence>
                  {activeRect && (
                    <motion.div
                      // oxlint-disable-next-line react/refs -- reading the session id during render is the point -- a new key mounts a fresh node with no geometry to animate from
                      key={sessionRef.current}
                      className={cn("pointer-events-none absolute", SHAPE.bg, HOVER_TINT)}
                      initial={{
                        opacity: 0,
                        top: checkedRect?.top ?? activeRect.top,
                        left: checkedRect?.left ?? activeRect.left,
                        width: checkedRect?.width ?? activeRect.width,
                        height: checkedRect?.height ?? activeRect.height,
                      }}
                      animate={{
                        opacity: 1,
                        top: activeRect.top,
                        left: activeRect.left,
                        width: activeRect.width,
                        height: activeRect.height,
                      }}
                      exit={{ opacity: 0, transition: spring.fast.exit }}
                      transition={{ ...spring.fast, opacity: { duration: 0.08 } }}
                    />
                  )}
                </AnimatePresence>

                {/* Focus ring */}
                <AnimatePresence>
                  {focusRect && (
                    <motion.div
                      className={cn(
                        "pointer-events-none absolute z-20 border border-ring",
                        SHAPE.focusRing,
                      )}
                      initial={false}
                      animate={{
                        left: focusRect.left - 2,
                        top: focusRect.top - 2,
                        width: focusRect.width + 4,
                        height: focusRect.height + 4,
                      }}
                      exit={{ opacity: 0, transition: spring.fast.exit }}
                      transition={{ ...spring.fast, opacity: { duration: 0.08 } }}
                    />
                  )}
                </AnimatePresence>

                {/* display: contents keeps items direct flex children of the popup, so
                    proximity measurement and gap layout still work while the group
                    provides the radio value context. */}
                <Menu.RadioGroup
                  value={value}
                  onValueChange={(next) => onChange(next as ColorFormat)}
                  className="contents"
                >
                  {FORMATS.map((fmt, i) => (
                    <FormatItem
                      key={fmt}
                      index={i}
                      value={fmt}
                      label={FORMAT_LABELS[fmt]}
                      checked={value === fmt}
                    />
                  ))}
                </Menu.RadioGroup>
              </Menu.Popup>
            </FormatMenuContext>
          </motion.div>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

// ---------------------------------------------------------------------------
// ColorInput
//
// Two internal variants behind one API:
//  - TextColorInput: draft-based text input (hex).
//  - ScrubColorInput: numeric channels on Base UI's NumberField, whose ScrubArea provides
//    pointer-lock scrubbing with a virtual cursor.
// ---------------------------------------------------------------------------

interface ColorInputProps {
  value: string
  onCommit: (next: string) => void
  ariaLabel: string
  className?: string
  inputClassName?: string
  align?: "left" | "center" | "right"
  prefix?: ReactNode
  inputMode?: "numeric" | "decimal" | "text"
  nudgeStep?: number
  nudgeShiftStep?: number
  hasPercent?: boolean
  decimals?: number
  scrubbable?: boolean
  min?: number
  max?: number
  /** With min and max, wrap (modulo) instead of clamping. For angular values like hue. */
  wrap?: boolean
}

const INPUT_SHELL_CLASS =
  "flex items-center bg-transparent transition-colors duration-75 hover:bg-accent active:bg-accent focus-within:ring-1 focus-within:ring-ring select-none h-9"

function boundValue(n: number, min?: number, max?: number, wrap = false): number {
  if (wrap && min !== undefined && max !== undefined) {
    if (n < min || n > max) {
      const range = max - min
      return ((((n - min) % range) + range) % range) + min
    }
    return n
  }
  let bounded = n
  if (min !== undefined) bounded = Math.max(min, bounded)
  if (max !== undefined) bounded = Math.min(max, bounded)
  return bounded
}

function TextColorInput({
  value,
  onCommit,
  ariaLabel,
  className,
  inputClassName,
  align = "left",
  prefix,
  inputMode = "text",
  nudgeStep,
  nudgeShiftStep,
  hasPercent = false,
  decimals,
  min,
  max,
  wrap = false,
}: ColorInputProps) {
  const [draft, setDraft] = useState(value)
  const interactingRef = useRef(false)

  useEffect(() => {
    if (!interactingRef.current) setDraft(value)
  }, [value])

  const commitNumber = (n: number) => {
    const bounded = boundValue(n, min, max, wrap)
    const formatted =
      decimals !== undefined ? bounded.toFixed(decimals) : String(Math.round(bounded))
    const withSuffix = hasPercent ? `${formatted}%` : formatted
    setDraft(withSuffix)
    onCommit(withSuffix)
  }

  const nudge = (direction: 1 | -1, shift: boolean) => {
    const baseStep = shift ? (nudgeShiftStep ?? 10) : (nudgeStep ?? 1)
    const cur = Number.parseFloat(draft.replace("%", ""))
    if (Number.isNaN(cur)) return
    commitNumber(cur + direction * baseStep)
  }

  return (
    <div className={cn(INPUT_SHELL_CLASS, "px-2", SHAPE.input, className)}>
      {prefix && (
        <span className="mr-1 text-[12px] text-muted-foreground select-none">{prefix}</span>
      )}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          interactingRef.current = true
          e.currentTarget.select()
        }}
        onBlur={() => {
          interactingRef.current = false
          if (draft === value) {
            setDraft(value)
            return
          }
          const numeric = Number.parseFloat(draft.replace("%", ""))
          if (!Number.isNaN(numeric) && (min !== undefined || max !== undefined))
            commitNumber(numeric)
          else onCommit(draft)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur()
          } else if (e.key === "Escape") {
            setDraft(value)
            e.currentTarget.blur()
          } else if (
            (nudgeStep !== undefined || nudgeShiftStep !== undefined) &&
            (e.key === "ArrowUp" || e.key === "ArrowDown")
          ) {
            e.preventDefault()
            nudge(e.key === "ArrowUp" ? 1 : -1, e.shiftKey)
          }
        }}
        inputMode={inputMode}
        aria-label={ariaLabel}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-[13px] font-medium text-foreground tabular-nums outline-none",
          align === "center" && "text-center",
          align === "right" && "text-right",
          inputClassName,
        )}
      />
    </div>
  )
}

function ScrubColorInput({
  value,
  onCommit,
  ariaLabel,
  className,
  inputClassName,
  align = "left",
  prefix,
  inputMode = "numeric",
  nudgeStep,
  nudgeShiftStep,
  hasPercent = false,
  decimals,
  min,
  max,
  wrap = false,
}: ColorInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  // Set on pointerdown inside the scrub area (capture phase, before Base UI focuses the
  // input for scrubbing) so onFocus can tell scrub-focus from keyboard focus.
  const pointerDownRef = useRef(false)

  const numeric = Number.parseFloat(value.replace("%", ""))
  const fieldValue = Number.isNaN(numeric) ? null : numeric

  const format = useMemo(() => {
    const f: Intl.NumberFormatOptions = { useGrouping: false }
    if (decimals !== undefined) {
      f.minimumFractionDigits = decimals
      f.maximumFractionDigits = decimals
    } else {
      f.maximumFractionDigits = 0
    }
    if (hasPercent) {
      // style "unit" + unit "percent" renders "50%" while keeping the numeric value on the
      // 0..100 scale (unlike style "percent", which would divide by 100).
      f.style = "unit"
      f.unit = "percent"
    }
    return f
  }, [decimals, hasPercent])

  const commit = useCallback(
    (n: number) => {
      // Hue-style wrap: NumberField won't wrap natively, so shim it here (361 → 1, -1 → 359).
      const bounded = boundValue(n, min, max, wrap)
      const formatted =
        decimals !== undefined ? bounded.toFixed(decimals) : String(Math.round(bounded))
      onCommit(hasPercent ? `${formatted}%` : formatted)
    },
    [wrap, min, max, decimals, hasPercent, onCommit],
  )

  return (
    <NumberField.Root
      value={fieldValue}
      onValueChange={(next, eventDetails) => {
        if (next === null) return
        // Keep commit-on-blur typing semantics: ignore per-keystroke parses and let the
        // blur land the final value. Nudges, scrubbing and wheel commit immediately.
        const reason = eventDetails.reason
        if (reason === "input-change" || reason === "input-paste" || reason === "input-clear") {
          return
        }
        commit(next)
      }}
      onValueCommitted={(_, eventDetails) => {
        // After a scrub ends, drop the focus Base UI placed on the input so the field
        // returns to rest. For a no-drag press, ScrubArea dispatches a synthetic click
        // right after this, which re-enters edit mode below.
        if (eventDetails.reason === "scrub") {
          pointerDownRef.current = false
          inputRef.current?.blur()
        }
      }}
      min={wrap ? undefined : min}
      max={wrap ? undefined : max}
      step={nudgeStep ?? 1}
      largeStep={nudgeShiftStep ?? 10}
      format={format}
      className={cn(INPUT_SHELL_CLASS, SHAPE.input, className)}
    >
      <NumberField.ScrubArea
        direction="horizontal"
        pixelSensitivity={1}
        onPointerDownCapture={() => {
          pointerDownRef.current = true
        }}
        onClick={() => {
          // Real clicks and the synthetic click after a no-drag press both land here →
          // enter edit mode, matching click-to-edit.
          pointerDownRef.current = false
          setEditing(true)
          inputRef.current?.focus()
          inputRef.current?.select()
        }}
        className={cn(
          "flex min-w-0 flex-1 items-center self-stretch px-2",
          !editing && "cursor-ew-resize",
        )}
      >
        <NumberField.ScrubAreaCursor className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]">
          <svg
            width={24}
            height={14}
            viewBox="0 0 24 14"
            fill="#000"
            stroke="#fff"
            strokeWidth={1}
            aria-hidden="true"
          >
            <path d="M0.5 7l5-5v3.5h13V2l5 5-5 5V8.5h-13V12l-5-5z" />
          </svg>
        </NumberField.ScrubAreaCursor>
        {prefix && (
          <span className="mr-1 text-[12px] text-muted-foreground select-none">{prefix}</span>
        )}
        <NumberField.Input
          ref={inputRef}
          aria-label={ariaLabel}
          inputMode={inputMode}
          onPointerDown={(e) => {
            // While editing, let the input place the caret instead of starting a scrub.
            if (editing) e.stopPropagation()
          }}
          onFocus={(e) => {
            if (pointerDownRef.current) return // scrub-initiated focus
            setEditing(true)
            e.currentTarget.select()
          }}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur()
              return
            }
            if (e.key !== "Escape") return
            // Restore the committed value's text before blurring, so the blur commit is a
            // no-op. Goes through the native setter because NumberField owns the value.
            const input = e.currentTarget
            // eslint-disable-next-line typescript/unbound-method -- invoked via .call below
            const setter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              "value",
            )?.set
            if (setter && fieldValue !== null) {
              const restored =
                decimals !== undefined
                  ? fieldValue.toFixed(decimals)
                  : String(Math.round(fieldValue))
              setter.call(input, hasPercent ? `${restored}%` : restored)
              input.dispatchEvent(new Event("input", { bubbles: true }))
            }
            input.blur()
          }}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-[13px] font-medium text-foreground tabular-nums outline-none",
            align === "center" && "text-center",
            align === "right" && "text-right",
            !editing && "pointer-events-none",
            inputClassName,
          )}
        />
      </NumberField.ScrubArea>
    </NumberField.Root>
  )
}

function ColorInput({ scrubbable = false, ...props }: ColorInputProps) {
  return scrubbable ? <ScrubColorInput {...props} /> : <TextColorInput {...props} />
}

// ---------------------------------------------------------------------------
// EyeDropperButton
// ---------------------------------------------------------------------------

interface EyeDropperGlobal {
  open: () => Promise<{ sRGBHex: string }>
}

function EyeDropperButton({ onPick }: { onPick: (hex: string) => void }) {
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- one-shot capability probe; window is only readable after mount
    setSupported(typeof window !== "undefined" && "EyeDropper" in window)
  }, [])

  if (!supported) return null

  const handleClick = async () => {
    try {
      const Ctor = (window as unknown as { EyeDropper: new () => EyeDropperGlobal }).EyeDropper
      const result = await new Ctor().open()
      onPick(result.sRGBHex)
    } catch {
      // User cancelled the picker.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Pick color from screen"
      className={cn(
        "flex cursor-pointer items-center justify-center px-3 text-muted-foreground hover:bg-accent hover:text-foreground active:bg-accent",
        CONTROL_CLASS,
        SHAPE.input,
      )}
    >
      <IconColorPicker className="size-4" />
    </button>
  )
}

// ---------------------------------------------------------------------------
// ColorTile / ColorSwatch
// ---------------------------------------------------------------------------

interface ColorTileProps {
  color: string
  size?: number
  className?: string
  style?: CSSProperties
}

function ColorTile({ color, size = 24, className, style }: ColorTileProps) {
  return (
    <span
      className={cn("relative inline-block shrink-0 overflow-hidden", SHAPE.bg, className)}
      style={{
        width: size,
        height: size,
        ...CHECKER_BG,
        boxShadow: "inset 0 0 0 1px rgba(127,127,127,0.25)",
        ...style,
      }}
    >
      <span className="absolute inset-0" style={{ backgroundColor: color }} />
    </span>
  )
}

function ColorSwatch({
  color,
  size = 28,
  selected,
  className,
  onMouseEnter,
  onMouseLeave,
  ref,
  ...props
}: ColorSwatchProps) {
  const [hovered, setHovered] = useState(false)
  const ring = selected
    ? "inset 0 0 0 1px rgba(127,127,127,0.25), 0 0 0 2px var(--color-popover), 0 0 0 4px var(--color-ring)"
    : hovered
      ? "inset 0 0 0 1px rgba(127,127,127,0.25), 0 0 0 2px var(--color-popover), 0 0 0 4px rgba(127,127,127,0.4)"
      : "inset 0 0 0 1px rgba(127,127,127,0.25)"
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Select color ${color}`}
      className={cn(
        "relative shrink-0 cursor-pointer overflow-hidden transition-shadow duration-100 outline-none",
        SHAPE.bg,
        className,
      )}
      style={{ width: size, height: size, ...CHECKER_BG, boxShadow: ring }}
      onMouseEnter={(e) => {
        setHovered(true)
        onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        setHovered(false)
        onMouseLeave?.(e)
      }}
      {...props}
    >
      <span className="absolute inset-0" style={{ backgroundColor: color }} />
    </button>
  )
}

function SwatchStrip({
  swatches,
  current,
  onPick,
}: {
  swatches: string[]
  current: string
  onPick: (color: string) => void
}) {
  const normalizedCurrent = useMemo(() => {
    const p = parseColor(current)
    return p ? rgbToHexStr(p.r, p.g, p.b, p.a).toLowerCase() : ""
  }, [current])

  // Named CSS colours ("red", "tomato") need the browser to normalise them before the
  // selected-state comparison can match. Resolved in an effect so render never touches the DOM.
  const [resolvedSwatches, setResolvedSwatches] = useState<Record<string, string>>({})
  useEffect(() => {
    const next: Record<string, string> = {}
    for (const sw of swatches) {
      if (parseColor(sw)) continue
      const p = resolveCssColor(sw)
      if (p) next[sw] = rgbToHexStr(p.r, p.g, p.b, p.a).toLowerCase()
    }
    // oxlint-disable-next-line react/set-state-in-effect -- swatches resolve against the DOM, so they can only be computed after paint
    setResolvedSwatches(next)
  }, [swatches])

  return (
    <div className="flex flex-wrap gap-2">
      {swatches.map((sw, i) => {
        const parsed = parseColor(sw)
        const normalized = parsed
          ? rgbToHexStr(parsed.r, parsed.g, parsed.b, parsed.a).toLowerCase()
          : (resolvedSwatches[sw] ?? sw.toLowerCase())
        return (
          <ColorSwatch
            // eslint-disable-next-line react/no-array-index-key -- swatches may repeat a colour
            key={`${sw}-${i}`}
            color={sw}
            size={28}
            selected={normalized === normalizedCurrent}
            onClick={() => onPick(sw)}
          />
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ColorPicker (panel)
// ---------------------------------------------------------------------------

function ColorPicker({
  value,
  defaultValue = "#6B97FF",
  onValueChange,
  format,
  defaultFormat = "hex",
  onFormatChange,
  swatches,
  hideEyedropper,
  formatOpen,
  defaultFormatOpen,
  className,
  ref,
  ...props
}: ColorPickerProps) {
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = useState(value ?? defaultValue)
  const currentRawValue = isControlled ? value : internalValue

  const isFormatControlled = format !== undefined
  const [internalFormat, setInternalFormat] = useState<ColorFormat>(defaultFormat)
  const currentFormat = isFormatControlled ? format : internalFormat

  // HSV is the canonical internal state; H is preserved across S=0 / V=0 transitions so
  // dragging to black and back doesn't reset the hue. Seeded from the initial value only.
  const [hsv, setHsv] = useState(() => {
    const p = parseColor(currentRawValue)
    if (!p) return { h: 0, s: 1, v: 1, a: 1 }
    const initial = rgbToHsv(p.r, p.g, p.b)
    return { h: initial.s === 0 ? 0 : initial.h, s: initial.s, v: initial.v, a: p.a }
  })

  // Sticky OKLCH hue: preserves the user's stated H across the lossy RGB round-trip (so the
  // displayed H doesn't drift after release) and across achromatic colours (where an
  // RGB-derived H collapses to 0). Cleared whenever a non-OKLCH channel drives the change.
  const oklchHueRef = useRef<number | null>(null)

  // External sync — when a controlled value changes from outside, re-seed HSV. Values we
  // emitted ourselves are skipped, since they'd otherwise round-trip and fight the drag.
  const lastEmittedRef = useRef<string>("")
  useEffect(() => {
    if (!isControlled) return
    if (value === lastEmittedRef.current) return
    const p = parseColor(value)
    if (!p) return
    oklchHueRef.current = null
    const next = rgbToHsv(p.r, p.g, p.b)
    // oxlint-disable-next-line react/set-state-in-effect -- syncs the internal hsv draft with the controlled value prop
    setHsv((prev) => ({
      h: next.s === 0 ? prev.h : next.h,
      s: next.s,
      v: next.v,
      a: p.a,
    }))
  }, [value, isControlled])

  const parsed = useMemo(() => buildParsed(hsv.h, hsv.s, hsv.v, hsv.a), [hsv])

  const emit = useCallback(
    (next: ParsedColor, fmt: ColorFormat) => {
      const formatted = formatValueByFormat(next, fmt)
      lastEmittedRef.current = formatted
      if (!isControlled) setInternalValue(formatted)
      onValueChange?.(formatted, next)
    },
    [isControlled, onValueChange],
  )

  const updateHsv = useCallback(
    (next: { h?: number; s?: number; v?: number; a?: number }) => {
      const merged = { ...hsv, ...next }
      setHsv(merged)
      emit(buildParsed(merged.h, merged.s, merged.v, merged.a), currentFormat)
    },
    [hsv, currentFormat, emit],
  )

  const handleFormatChange = useCallback(
    (f: ColorFormat) => {
      if (!isFormatControlled) setInternalFormat(f)
      onFormatChange?.(f)
      emit(parsed, f)
    },
    [isFormatControlled, onFormatChange, emit, parsed],
  )

  const handleHexCommit = useCallback(
    (input: string) => {
      // resolveCssColor falls back to browser normalisation, so named CSS colours from
      // swatches or the hex field work too. Safe here: only ever runs in event handlers.
      const p = resolveCssColor(input)
      if (!p) return
      oklchHueRef.current = null
      const next = rgbToHsv(p.r, p.g, p.b)
      const merged = {
        h: next.s === 0 ? hsv.h : next.h,
        s: next.s,
        v: next.v,
        a: p.a,
      }
      setHsv(merged)
      emit(buildParsed(merged.h, merged.s, merged.v, merged.a), currentFormat)
    },
    [hsv.h, currentFormat, emit],
  )

  const solidHueRgb = useMemo(() => hsvToRgb(hsv.h, hsv.s, hsv.v), [hsv.h, hsv.s, hsv.v])
  const solidR = Math.round(solidHueRgb.r)
  const solidG = Math.round(solidHueRgb.g)
  const solidB = Math.round(solidHueRgb.b)
  const solidColorString = `rgb(${solidR}, ${solidG}, ${solidB})`

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-2 border bg-popover p-3 text-popover-foreground shadow-md",
        SHAPE.container,
        className,
      )}
      style={{ width: PANEL_WIDTH }}
      {...props}
    >
      <SaturationSquare h={hsv.h} s={hsv.s} v={hsv.v} onChange={(s, v) => updateHsv({ s, v })} />

      <div className="flex flex-col gap-1">
        <HueSlider
          h={hsv.h}
          onChange={(h) => {
            oklchHueRef.current = null
            updateHsv({ h })
          }}
        />
        <AlphaSlider
          a={hsv.a}
          solidColor={solidColorString}
          solidR={solidR}
          solidG={solidG}
          solidB={solidB}
          onChange={(a) => updateHsv({ a })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <FormatDropdown
          value={currentFormat}
          onChange={handleFormatChange}
          open={formatOpen}
          defaultOpen={defaultFormatOpen}
        />
        {!hideEyedropper && <EyeDropperButton onPick={handleHexCommit} />}
      </div>

      <ColorInputsRow
        parsed={parsed}
        format={currentFormat}
        // oxlint-disable-next-line react/refs -- the hue ref carries the last non-achromatic hue so the wheel does not jump on greys
        oklchHue={oklchHueRef.current}
        onChannelChange={(channel, channelValue) => {
          const p = parsed
          switch (channel) {
            case "hex": {
              handleHexCommit(channelValue)
              return
            }
            case "r":
            case "g":
            case "b": {
              oklchHueRef.current = null
              const r = channel === "r" ? Number(channelValue) : p.r
              const g = channel === "g" ? Number(channelValue) : p.g
              const b = channel === "b" ? Number(channelValue) : p.b
              const next = rgbToHsv(r, g, b)
              updateHsv({ h: next.s === 0 ? hsv.h : next.h, s: next.s, v: next.v })
              return
            }
            case "hSL":
            case "sSL":
            case "lSL": {
              if (channel === "hSL") oklchHueRef.current = null
              const hsl = rgbToHsl(p.r, p.g, p.b)
              const h2 = channel === "hSL" ? Number(channelValue) : hsl.h
              const s2 = channel === "sSL" ? Number(channelValue) / 100 : hsl.s
              const l2 = channel === "lSL" ? Number(channelValue) / 100 : hsl.l
              const rgb = hslToRgb(h2, clamp01(s2), clamp01(l2))
              const next = rgbToHsv(rgb.r, rgb.g, rgb.b)
              updateHsv({ h: next.s === 0 ? h2 : next.h, s: next.s, v: next.v })
              return
            }
            case "L":
            case "C":
            case "H": {
              const cur = rgbToOklch(p.r, p.g, p.b)
              // For L/C edits, anchor on the user's last stated H so hue doesn't drift
              // along with chroma changes.
              const baseH = oklchHueRef.current ?? cur.H
              const L = channel === "L" ? Number(channelValue) / 100 : cur.L
              const C = channel === "C" ? Number(channelValue) : cur.C
              const H = channel === "H" ? Number(channelValue) : baseH
              oklchHueRef.current = H
              const rgb = oklchToRgb(clamp01(L), Math.max(0, C), H)
              const next = rgbToHsv(rgb.r, rgb.g, rgb.b)
              updateHsv({ h: next.s === 0 ? hsv.h : next.h, s: next.s, v: next.v })
              return
            }
            case "alphaPercent":
            default: {
              updateHsv({ a: clamp01(Number(channelValue) / 100) })
            }
          }
        }}
      />

      {swatches && swatches.length > 0 && (
        <SwatchStrip swatches={swatches} current={parsed.hex} onPick={handleHexCommit} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ColorInputsRow — adapts inputs to format
// ---------------------------------------------------------------------------

type ChannelKey = "hex" | "r" | "g" | "b" | "hSL" | "sSL" | "lSL" | "L" | "C" | "H" | "alphaPercent"

function ChannelTooltip({ label, children }: { label: string; children: ReactNode }) {
  const portalContainer = use(ColorPickerPortalContainerContext)
  return (
    // Own provider per channel so the delay is per-input, as upstream had it — these labels
    // are hints, and skipping the wait while sweeping across the row would make them flicker.
    <TooltipProvider delay={300}>
      <Tooltip>
        <TooltipTrigger render={<div />}>{children}</TooltipTrigger>
        <TooltipContent container={portalContainer}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function ChannelInput({
  label,
  value,
  onCommit,
  ...props
}: { label: string } & Omit<ColorInputProps, "ariaLabel">) {
  return (
    <ChannelTooltip label={label}>
      <ColorInput
        value={value}
        onCommit={onCommit}
        ariaLabel={label}
        align="center"
        scrubbable
        nudgeStep={1}
        nudgeShiftStep={10}
        {...props}
      />
    </ChannelTooltip>
  )
}

function AlphaInput({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  return (
    <ChannelInput
      label="Alpha"
      value={`${value}%`}
      onCommit={(input) => {
        const n = Number.parseFloat(input.replace("%", ""))
        if (Number.isNaN(n)) return
        onCommit(Math.max(0, Math.min(100, Math.round(n))))
      }}
      inputMode="numeric"
      hasPercent
      min={0}
      max={100}
    />
  )
}

function ColorInputsRow({
  parsed,
  format,
  oklchHue,
  onChannelChange,
}: {
  parsed: ParsedColor
  format: ColorFormat
  /** Sticky OKLCH hue override for display, preserving the stated H across round-trip drift. */
  oklchHue?: number | null
  onChannelChange: (key: ChannelKey, value: string) => void
}) {
  const alphaPct = Math.round(parsed.a * 100)
  const alpha = (
    <AlphaInput value={alphaPct} onCommit={(n) => onChannelChange("alphaPercent", String(n))} />
  )

  if (format === "hex") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <ChannelTooltip label="Hex">
          <ColorInput
            value={parsed.hex.replace(/^#/, "").toUpperCase()}
            onCommit={(next) => onChannelChange("hex", next.startsWith("#") ? next : `#${next}`)}
            ariaLabel="Hex value"
            prefix="#"
          />
        </ChannelTooltip>
        {alpha}
      </div>
    )
  }

  if (format === "rgb") {
    return (
      <div className="grid grid-cols-4 gap-1">
        <ChannelInput
          label="Red"
          value={String(parsed.r)}
          onCommit={(n) => onChannelChange("r", n)}
          min={0}
          max={255}
        />
        <ChannelInput
          label="Green"
          value={String(parsed.g)}
          onCommit={(n) => onChannelChange("g", n)}
          min={0}
          max={255}
        />
        <ChannelInput
          label="Blue"
          value={String(parsed.b)}
          onCommit={(n) => onChannelChange("b", n)}
          min={0}
          max={255}
        />
        {alpha}
      </div>
    )
  }

  if (format === "hsl") {
    const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b)
    return (
      <div className="grid grid-cols-4 gap-1">
        <ChannelInput
          label="Hue"
          value={String(Math.round(hsl.h))}
          onCommit={(n) => onChannelChange("hSL", n)}
          min={0}
          max={360}
          wrap
        />
        <ChannelInput
          label="Saturation"
          value={String(Math.round(hsl.s * 100))}
          onCommit={(n) => onChannelChange("sSL", n)}
          min={0}
          max={100}
        />
        <ChannelInput
          label="Lightness"
          value={String(Math.round(hsl.l * 100))}
          onCommit={(n) => onChannelChange("lSL", n)}
          min={0}
          max={100}
        />
        {alpha}
      </div>
    )
  }

  const oklch = rgbToOklch(parsed.r, parsed.g, parsed.b)
  return (
    <div className="grid grid-cols-4 gap-1">
      <ChannelInput
        label="Lightness"
        value={(oklch.L * 100).toFixed(0)}
        onCommit={(n) => onChannelChange("L", n)}
        inputMode="decimal"
        min={0}
        max={100}
      />
      <ChannelInput
        label="Chroma"
        value={oklch.C.toFixed(2)}
        onCommit={(n) => onChannelChange("C", n)}
        inputMode="decimal"
        nudgeStep={0.01}
        nudgeShiftStep={0.1}
        decimals={2}
        min={0}
        max={0.4}
      />
      <ChannelInput
        label="Hue"
        value={(oklchHue ?? oklch.H).toFixed(0)}
        onCommit={(n) => onChannelChange("H", n)}
        min={0}
        max={360}
        wrap
      />
      {alpha}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ColorPickerPopover (trigger button + popover panel)
//
// Base UI's Popover owns positioning (anchor tracking + collision flipping), dismissal and
// focus management. The spring open/close survives via the same deferred-unmount pattern
// the format menu uses.
// ---------------------------------------------------------------------------

function ColorPickerPopover({
  triggerLabel,
  triggerLabelPosition = "left",
  triggerShowValue = true,
  triggerShowRemove = false,
  onTriggerRemove,
  triggerClassName,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ref,
  ...pickerProps
}: ColorPickerPopoverProps) {
  const isOpenControlled = openProp !== undefined
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const open = isOpenControlled ? openProp : internalOpen
  const actionsRef = useRef<{ unmount: () => void; close: () => void }>(null)
  const [panelEl, setPanelEl] = useState<HTMLDivElement | null>(null)
  // The popover itself mounts into the ambient container (a shadow root, in content
  // scripts); layers inside the panel re-anchor to the panel below.
  const outerContainer = use(ColorPickerPortalContainerContext)

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!isOpenControlled) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [isOpenControlled, onOpenChange],
  )

  const isControlled = pickerProps.value !== undefined
  const [internalValue, setInternalValue] = useState(
    pickerProps.value ?? pickerProps.defaultValue ?? "#6B97FF",
  )
  const currentValue = isControlled ? pickerProps.value! : internalValue

  const onPickerValueChange = pickerProps.onValueChange
  const handleValueChange = useCallback(
    (v: string, parsed: ParsedColor) => {
      if (!isControlled) setInternalValue(v)
      onPickerValueChange?.(v, parsed)
    },
    [isControlled, onPickerValueChange],
  )

  // Release Base UI's deferred unmount once the exit tween has played; the timeout is the
  // fallback for throttled tabs (spring.moderate.exit is 120ms — 150ms covers it).
  useEffect(() => {
    if (open) return undefined
    const id = setTimeout(() => actionsRef.current?.unmount(), 150)
    return () => clearTimeout(id)
  }, [open])

  const parsed = useMemo(() => parseColor(currentValue), [currentValue])
  const swatchColor = parsed ? rgbToHexStr(parsed.r, parsed.g, parsed.b, parsed.a) : currentValue
  const valueLabel = parsed
    ? rgbToHexStr(parsed.r, parsed.g, parsed.b, 1).replace(/^#/, "").toUpperCase()
    : currentValue

  return (
    <Popover.Root
      open={open}
      onOpenChange={handleOpenChange}
      actionsRef={actionsRef}
      // Non-modal: the page keeps scrolling and the Positioner tracks the anchor, so the
      // panel follows its trigger instead of detaching.
      modal={false}
    >
      <div ref={ref} className="inline-flex">
        <Popover.Trigger
          className={cn(
            "flex cursor-pointer items-center gap-2 border border-border px-2 text-[13px] font-medium hover:bg-accent",
            CONTROL_CLASS,
            SHAPE.input,
            triggerClassName,
          )}
        >
          {triggerLabel && triggerLabelPosition === "left" && (
            <span className="px-1 text-muted-foreground select-none">{triggerLabel}</span>
          )}
          <ColorTile color={swatchColor} size={20} />
          {triggerShowValue && <span className="text-foreground tabular-nums">{valueLabel}</span>}
          {triggerLabel && triggerLabelPosition === "right" && (
            <span className="px-1 text-muted-foreground select-none">{triggerLabel}</span>
          )}
          {triggerShowRemove && (
            <span
              role="button"
              aria-label="Remove color"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onTriggerRemove?.()
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation()
                  e.preventDefault()
                  onTriggerRemove?.()
                }
              }}
              className="ml-1 flex cursor-pointer items-center text-muted-foreground hover:text-foreground"
            >
              <IconX className="size-3.5" />
            </span>
          )}
        </Popover.Trigger>
        <Popover.Portal container={outerContainer ?? undefined}>
          {/* pointer-events-auto: see the format menu's positioner — the subtitles panel's
              shadow host is pointer-events:none so clicks fall through to the video. */}
          <Popover.Positioner
            side="bottom"
            align="start"
            sideOffset={6}
            className="pointer-events-auto z-50 outline-none"
          >
            <motion.div
              initial={{ opacity: 0, y: -4, scaleY: 0.96 }}
              animate={open ? { opacity: 1, y: 0, scaleY: 1 } : { opacity: 0, y: -4, scaleY: 0.96 }}
              transition={open ? spring.moderate : spring.moderate.exit}
              style={{ transformOrigin: "top left" }}
              onAnimationComplete={() => {
                if (!open) actionsRef.current?.unmount()
              }}
            >
              <Popover.Popup
                ref={setPanelEl}
                data-slot="color-picker-content"
                className="outline-none"
              >
                <ColorPickerPortalContainer value={panelEl}>
                  <ColorPicker
                    {...pickerProps}
                    value={currentValue}
                    onValueChange={handleValueChange}
                    className={cn("shadow-lg", pickerProps.className)}
                  />
                </ColorPickerPortalContainer>
              </Popover.Popup>
            </motion.div>
          </Popover.Positioner>
        </Popover.Portal>
      </div>
    </Popover.Root>
  )
}

export {
  buildParsed,
  ColorPicker,
  ColorPickerPopover,
  ColorPickerPortalContainer,
  ColorSwatch,
  ColorTile,
  parseColor,
}

export type {
  ColorFormat,
  ColorPickerPopoverProps,
  ColorPickerProps,
  ColorSwatchProps,
  ParsedColor,
}
