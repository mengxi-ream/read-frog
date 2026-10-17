import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react"
import type { SliderValue } from "@/components/ui/base-ui/slider"
import { Menu } from "@base-ui/react/menu"
import { NumberField } from "@base-ui/react/number-field"
import { Popover } from "@base-ui/react/popover"
import { IconChevronDown, IconColorPicker } from "@tabler/icons-react"
import { AnimatePresence, motion } from "motion/react"
import { createContext, use, useEffect, useMemo, useRef, useState } from "react"
import { Slider } from "@/components/ui/base-ui/slider"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/base-ui/tooltip"
import { useProximityHover } from "@/hooks/use-proximity-hover"
import { exitFallbackMs, spring } from "@/utils/styles/springs"
import { cn } from "@/utils/styles/utils"

/**
 * A port of fluidfunctionalism.com/docs/color-picker — a HEX/RGB/HSL/OKLCH picker with an
 * alpha channel, a saturation/brightness square, scrubbable channel inputs, and the native
 * eyedropper. Replaces the `<input type="color">` we used for subtitle colours, which gave us
 * the OS picker (unthemed, unreachable from a content script's shadow DOM, and hex-only).
 *
 * Adapted to this codebase in three places, since the source ships against its own design
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
 * `ColorPickerPopover` takes a `container` for its portal, like `SelectContent` does. Content
 * scripts must pass one — a portal defaulting to `document.body` lands outside the shadow
 * root, where none of our styles reach. The format menu and channel tooltips then mount
 * inside the panel, so they follow it rather than the page.
 */

type ColorFormat = "hex" | "rgb" | "hsl" | "oklch"

/** Where the panel's own portalled layers (format menu, channel tooltips) mount. */
const PortalContainerContext = createContext<HTMLElement | null>(null)

interface Rgb {
  r: number
  g: number
  b: number
}

interface Rgba extends Rgb {
  a: number
}

/**
 * The picker's canonical state: HSV (0..360 / 0..1 / 0..1) plus alpha. `h` is kept across
 * S=0 / V=0, so dragging to black and back doesn't reset the hue. `oklchH` does the same for
 * the OKLCH hue channel: it holds the user's stated H across the lossy RGB round-trip (so the
 * displayed H doesn't drift after release) and across achromatic colours (where an
 * RGB-derived H collapses to 0). It only describes the colour it was stated for, so `update`
 * drops it whenever h, s or v move, except on an OKLCH channel edit, which sets it. Alpha
 * edits keep it.
 */
interface ColorState {
  h: number
  s: number
  v: number
  a: number
  oklchH: number | null
}

interface ColorPickerValueProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  format?: ColorFormat
  defaultFormat?: ColorFormat
  onFormatChange?: (format: ColorFormat) => void
  hideEyedropper?: boolean
}

interface ColorPickerProps
  extends ColorPickerValueProps, Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  ref?: Ref<HTMLDivElement>
}

interface ColorPickerPopoverProps extends ColorPickerValueProps {
  triggerLabel?: string
  triggerShowValue?: boolean
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
  /** Where the popover mounts. Content scripts pass a node inside their shadow root. */
  container?: HTMLElement | null
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

/**
 * The hue-sector step HSV and HSL share on the way to RGB: `c` is the chroma and `m` the
 * amount added to every channel.
 */
function hueToRgb(h: number, c: number, m: number): Rgb {
  const hh = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hh % 2) - 1))
  const [r, g, b] =
    hh < 1
      ? [c, x, 0]
      : hh < 2
        ? [x, c, 0]
        : hh < 3
          ? [0, c, x]
          : hh < 4
            ? [0, x, c]
            : hh < 5
              ? [x, 0, c]
              : [c, 0, x]
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

function hsvToRgb(h: number, s: number, v: number): Rgb {
  const c = v * s
  return hueToRgb(h, c, v - c)
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  return hueToRgb(h, c, l - c / 2)
}

/** The hue HSV and HSL share, from 0..1 channels with their max and max − min. 0 for greys. */
function hueOf(r: number, g: number, b: number, max: number, d: number): number {
  if (d === 0) return 0
  const h = 60 * (max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4)
  return h < 0 ? h + 360 : h
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  return { h: hueOf(r, g, b, max, d), s: max === 0 ? 0 : d / max, v: max }
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : l > 0.5 ? d / (2 - max - min) : d / (max + min)
  return { h: hueOf(r, g, b, max, d), s, l }
}

/** RGB → HSV, keeping `fallbackH` for greys, where the RGB-derived hue collapses to 0. */
function rgbToHsvKeepingHue({ r, g, b }: Rgb, fallbackH: number) {
  const hsv = rgbToHsv(r, g, b)
  return { h: hsv.s === 0 ? fallbackH : hsv.h, s: hsv.s, v: hsv.v }
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

function oklabToLinearRgb(L: number, a: number, b: number): Rgb {
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

function oklchToRgb(L: number, C: number, H: number): Rgb {
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

function parseHex(input: string): Rgba | null {
  const m = input.trim().match(/^#?([0-9a-f]{3,8})$/i)
  if (!m?.[1]) return null
  const h = expandShortHex(m[1])
  if (h.length !== 6 && h.length !== 8) return null
  const byte = (i: number) => Number.parseInt(h.slice(i, i + 2), 16)
  return { r: byte(0), g: byte(2), b: byte(4), a: h.length === 8 ? byte(6) / 255 : 1 }
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

function parseColor(input: string): Rgba | null {
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

/** The RGB the inputs display and edit against: whole channels. */
function roundedRgb({ h, s, v }: ColorState): Rgb {
  const { r, g, b } = hsvToRgb(h, s, v)
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) }
}

/** Serialises the state in one format. HSL and OKLCH start from the unrounded RGB. */
function formatColor({ h, s, v, a }: ColorState, format: ColorFormat): string {
  const { r, g, b } = hsvToRgb(h, s, v)
  const alpha = a >= 1 ? null : Number(a.toFixed(3))
  switch (format) {
    case "rgb": {
      const body = `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`
      return alpha === null ? `rgb(${body})` : `rgba(${body}, ${alpha})`
    }
    case "hsl": {
      const hsl = rgbToHsl(r, g, b)
      const body = `${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%`
      return alpha === null ? `hsl(${body})` : `hsla(${body}, ${alpha})`
    }
    case "oklch": {
      const oklch = rgbToOklch(r, g, b)
      const body = `${(oklch.L * 100).toFixed(1)}% ${oklch.C.toFixed(3)} ${oklch.H.toFixed(1)}`
      return alpha === null ? `oklch(${body})` : `oklch(${body} / ${alpha})`
    }
    default:
      return rgbToHexStr(r, g, b, a)
  }
}

function isSameState(a: ColorState, b: ColorState) {
  return a.h === b.h && a.s === b.s && a.v === b.v && a.a === b.a && a.oklchH === b.oklchH
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_VALUE = "#6B97FF"
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

const POPUP_HIDDEN = { opacity: 0, y: -4, scaleY: 0.96 }
const POPUP_SHOWN = { opacity: 1, y: 0, scaleY: 1 }

/**
 * The spring open/close shared by the popover and the format menu. Base UI unmounts a popup
 * only when told to through `actionsRef`, so the motion wrapper releases it once the exit
 * tween has played; the timer is the fallback for throttled tabs, where rAF-driven animation
 * callbacks stall.
 */
function useSpringPopup(open: boolean, tier: (typeof spring)[keyof typeof spring]) {
  const actionsRef = useRef<{ unmount: () => void; close: () => void }>(null)

  useEffect(() => {
    if (open) return undefined
    const id = setTimeout(() => actionsRef.current?.unmount(), exitFallbackMs(tier))
    return () => clearTimeout(id)
  }, [open, tier])

  return {
    actionsRef,
    motionProps: {
      initial: POPUP_HIDDEN,
      animate: open ? POPUP_SHOWN : POPUP_HIDDEN,
      transition: open ? tier : tier.exit,
      onAnimationComplete: () => {
        if (!open) actionsRef.current?.unmount()
      },
    },
  }
}

// ---------------------------------------------------------------------------
// SaturationSquare
// ---------------------------------------------------------------------------

/** Arrow-key nudges for the square, as [Δs, Δv] in steps. */
const ARROW_NUDGE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
}

interface SaturationSquareProps {
  h: number
  s: number
  v: number
  color: string
  onChange: (s: number, v: number) => void
}

function SaturationSquare({ h, s, v, color, onChange }: SaturationSquareProps) {
  const ref = useRef<HTMLDivElement>(null)
  // State, not a ref: this gates the ghost hover cursor during render, and a ref mutation
  // wouldn't re-render, leaving the ghost stuck on screen.
  const [dragging, setDragging] = useState(false)
  // Where the pointer hovers, in percent of the square; null while it is outside.
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  const pointerRatio = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const nudge = ARROW_NUDGE[e.key]
    if (!nudge) return
    e.preventDefault()
    const step = e.shiftKey ? 0.1 : 0.01
    onChange(clamp01(s + nudge[0] * step), clamp01(v + nudge[1] * step))
  }

  return (
    <div
      ref={ref}
      role="application"
      aria-label="Saturation and brightness"
      tabIndex={0}
      onPointerLeave={() => setCursorPos(null)}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return
        e.preventDefault()
        setDragging(true)
        e.currentTarget.setPointerCapture(e.pointerId)
        const p = pointerRatio(e)
        if (p) onChange(p.x, 1 - p.y)
      }}
      onPointerMove={(e) => {
        const p = pointerRatio(e)
        if (!p) return
        setCursorPos({ x: p.x * 100, y: p.y * 100 })
        if (dragging) onChange(p.x, 1 - p.y)
      }}
      onPointerUp={() => setDragging(false)}
      // A drag can also end without a pointerup (pointercancel, capture taken away); a stale
      // flag would then let a plain hover move the colour.
      onLostPointerCapture={() => setDragging(false)}
      onKeyDown={onKeyDown}
      className={cn(
        "relative w-full cursor-none touch-none outline-none select-none focus-visible:ring-2 focus-visible:ring-ring",
        SHAPE.bg,
      )}
      style={{ height: SQUARE_HEIGHT }}
    >
      <div
        className={cn("absolute inset-0 overflow-hidden", SHAPE.bg)}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h}, 100%, 50%))`,
        }}
      />
      <div
        className="pointer-events-none absolute size-[18px] -translate-1/2 rounded-full"
        style={{
          left: `${s * 100}%`,
          top: `${(1 - v) * 100}%`,
          border: "1px solid white",
          boxShadow: "0 0 0 1px rgba(0,0,0,1)",
          backgroundColor: color,
        }}
      />
      {!dragging && cursorPos && (
        <div
          className="pointer-events-none absolute size-[18px] -translate-1/2 rounded-full"
          style={{
            left: `${cursorPos.x}%`,
            top: `${cursorPos.y}%`,
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

function AlphaSlider({ a, rgb, onChange }: { a: number; rgb: Rgb; onChange: (a: number) => void }) {
  const solid = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
  // A colour-aware transparent stop (same channels, alpha 0) keeps the gradient
  // chromatically consistent and reaches fully opaque with no edge gap.
  const transparent = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`
  return (
    <Slider
      value={Math.round(a * 100)}
      onChange={(v) => onChange(toSingle(v) / 100)}
      min={0}
      max={100}
      step={1}
      showValue={false}
      hideFill
      thumbColor={solid}
      thumbBorderColor="rgba(255,255,255,0.9)"
      aria-label="Alpha"
      trackStyle={{
        backgroundImage: `linear-gradient(to right, ${transparent} 0%, ${solid} 98%), ${CHECKER_BG.backgroundImage}`,
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
// proximity-hover overlays and the spring open/close animation.
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
}

const FormatMenuContext = createContext<FormatMenuContextValue | null>(null)

function FormatItem({
  index,
  value,
  checked,
}: {
  index: number
  value: ColorFormat
  checked: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const menuCtx = use(FormatMenuContext)
  const registerItem = menuCtx?.registerItem
  const label = FORMAT_LABELS[value]

  useEffect(() => {
    registerItem?.(index, ref.current)
    return () => registerItem?.(index, null)
  }, [index, registerItem])

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
}: {
  value: ColorFormat
  onChange: (f: ColorFormat) => void
}) {
  const [open, setOpen] = useState(false)
  const { actionsRef, motionProps } = useSpringPopup(open, spring.fast)
  const portalContainer = use(PortalContainerContext)
  const containerRef = useRef<HTMLDivElement>(null)

  // Items register on mount, which schedules their measurement; no extra pass on open.
  const { activeIndex, setActiveIndex, itemRects, session, handlers, registerItem } =
    useProximityHover(containerRef)

  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

  const checkedIndex = FORMATS.indexOf(value)
  const activeRect = activeIndex !== null ? itemRects[activeIndex] : null
  const checkedRect = checkedIndex !== -1 ? itemRects[checkedIndex] : null
  const focusRect = focusedIndex !== null ? itemRects[focusedIndex] : null
  const menuCtx = useMemo(() => ({ registerItem, activeIndex }), [registerItem, activeIndex])

  return (
    <Menu.Root
      open={open}
      onOpenChange={setOpen}
      actionsRef={actionsRef}
      // Non-modal: the page keeps scrolling and the Positioner tracks the anchor, so the
      // popup follows its trigger instead of detaching.
      modal={false}
    >
      <Menu.Trigger
        className={cn(
          "flex cursor-pointer items-center justify-between gap-2 px-3 text-[13px] font-medium hover:bg-muted hover:text-foreground",
          CONTROL_CLASS,
          SHAPE.input,
          open ? "bg-muted text-foreground" : "text-muted-foreground active:bg-muted",
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
          <motion.div {...motionProps} style={{ transformOrigin: "top center" }}>
            <FormatMenuContext value={menuCtx}>
              <Menu.Popup
                ref={containerRef}
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
                      key={session}
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
                    <FormatItem key={fmt} index={i} value={fmt} checked={value === fmt} />
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
// Channel inputs
//
//  - HexInput: a draft-based text input that commits on blur.
//  - ScrubInput: a numeric channel on Base UI's NumberField, whose ScrubArea provides
//    pointer-lock scrubbing with a virtual cursor.
// ---------------------------------------------------------------------------

const INPUT_SHELL_CLASS =
  "flex items-center bg-transparent transition-colors duration-75 hover:bg-muted active:bg-muted focus-within:ring-1 focus-within:ring-ring select-none h-9"

const INPUT_TEXT_CLASS =
  "min-w-0 flex-1 bg-transparent text-[13px] font-medium text-foreground tabular-nums outline-none"

function ChannelTooltip({ label, children }: { label: string; children: ReactNode }) {
  const portalContainer = use(PortalContainerContext)
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

function HexInput({ value, onCommit }: { value: string; onCommit: (next: string) => void }) {
  const [draft, setDraft] = useState(value)
  const editingRef = useRef(false)
  // Escape blurs before its reset renders, so the blur handler still sees the typed draft.
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (!editingRef.current) setDraft(value)
  }, [value])

  return (
    <div className={cn(INPUT_SHELL_CLASS, "px-2", SHAPE.input)}>
      <span className="mr-1 text-[12px] text-muted-foreground select-none">#</span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          editingRef.current = true
          e.currentTarget.select()
        }}
        onBlur={() => {
          editingRef.current = false
          if (cancelledRef.current) cancelledRef.current = false
          else if (draft !== value) onCommit(draft)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur()
          } else if (e.key === "Escape") {
            cancelledRef.current = true
            setDraft(value)
            e.currentTarget.blur()
          }
        }}
        inputMode="text"
        aria-label="Hex value"
        className={INPUT_TEXT_CLASS}
      />
    </div>
  )
}

interface ChannelSpec {
  label: string
  min: number
  max: number
  /** Wrap (modulo) instead of clamping. For angular values like hue. */
  wrap?: boolean
  decimals?: number
  step?: number
  largeStep?: number
  percent?: boolean
  inputMode?: "numeric" | "decimal"
}

function boundValue(n: number, min: number, max: number, wrap: boolean): number {
  if (!wrap) return Math.min(max, Math.max(min, n))
  if (n >= min && n <= max) return n
  const range = max - min
  return ((((n - min) % range) + range) % range) + min
}

function ScrubInput({
  label,
  min,
  max,
  wrap = false,
  decimals,
  step = 1,
  largeStep = 10,
  percent = false,
  inputMode = "numeric",
  value,
  onCommit,
}: ChannelSpec & { value: number; onCommit: (n: number) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  // Set on pointerdown inside the scrub area (capture phase, before Base UI focuses the
  // input for scrubbing) so onFocus can tell scrub-focus from keyboard focus.
  const pointerDownRef = useRef(false)
  // Set by Escape: the blur that follows drops the typed text instead of committing it.
  const cancelledRef = useRef(false)

  const format = useMemo(() => {
    const f: Intl.NumberFormatOptions = { useGrouping: false }
    if (decimals !== undefined) {
      f.minimumFractionDigits = decimals
      f.maximumFractionDigits = decimals
    } else {
      f.maximumFractionDigits = 0
    }
    if (percent) {
      // style "unit" + unit "percent" renders "50%" while keeping the numeric value on the
      // 0..100 scale (unlike style "percent", which would divide by 100).
      f.style = "unit"
      f.unit = "percent"
    }
    return f
  }, [decimals, percent])

  const round = (n: number) =>
    decimals === undefined ? Math.round(n) : Number(n.toFixed(decimals))

  return (
    <NumberField.Root
      value={value}
      onValueChange={(next, eventDetails) => {
        if (next === null) return
        // Keep commit-on-blur typing semantics: ignore per-keystroke parses and let the
        // blur land the final value. Nudges, scrubbing and wheel commit immediately.
        const reason = eventDetails.reason
        if (reason === "input-change" || reason === "input-paste" || reason === "input-clear") {
          return
        }
        // Cancelling the blur commit leaves the controlled value alone, and NumberField then
        // reprints it in place of the typed text.
        if (reason === "input-blur" && cancelledRef.current) {
          eventDetails.cancel()
          return
        }
        // Hue-style wrap: NumberField won't wrap natively, so shim it here (361 → 1, -1 → 359).
        onCommit(round(boundValue(next, min, max, wrap)))
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
      step={step}
      largeStep={largeStep}
      format={format}
      className={cn(INPUT_SHELL_CLASS, SHAPE.input)}
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
        <NumberField.Input
          ref={inputRef}
          aria-label={label}
          inputMode={inputMode}
          onPointerDown={(e) => {
            // While editing, let the input place the caret instead of starting a scrub.
            if (editing) e.stopPropagation()
          }}
          onFocus={(e) => {
            cancelledRef.current = false
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
            if (e.key === "Escape") {
              cancelledRef.current = true
              e.currentTarget.blur()
            }
          }}
          className={cn(INPUT_TEXT_CLASS, "text-center", !editing && "pointer-events-none")}
        />
      </NumberField.ScrubArea>
    </NumberField.Root>
  )
}

/**
 * The three numeric channels of each non-hex format. `read` gives them as the inputs show
 * them, from the rounded RGB; `write` turns one committed channel back into a state patch,
 * keeping the other two at full precision.
 */
interface ChannelModel {
  channels: [ChannelSpec, ChannelSpec, ChannelSpec]
  read: (rgb: Rgb, color: ColorState) => [number, number, number]
  write: (index: number, n: number, rgb: Rgb, color: ColorState) => Partial<ColorState>
}

const BYTE = { min: 0, max: 255 }
const PERCENT = { min: 0, max: 100 }
const DEGREES = { min: 0, max: 360, wrap: true }

const CHANNEL_MODELS: Record<Exclude<ColorFormat, "hex">, ChannelModel> = {
  rgb: {
    channels: [
      { label: "Red", ...BYTE },
      { label: "Green", ...BYTE },
      { label: "Blue", ...BYTE },
    ],
    read: ({ r, g, b }) => [r, g, b],
    write: (index, n, { r, g, b }, color) => {
      const next = { r: index === 0 ? n : r, g: index === 1 ? n : g, b: index === 2 ? n : b }
      return rgbToHsvKeepingHue(next, color.h)
    },
  },
  hsl: {
    channels: [
      { label: "Hue", ...DEGREES },
      { label: "Saturation", ...PERCENT },
      { label: "Lightness", ...PERCENT },
    ],
    read: ({ r, g, b }) => {
      const hsl = rgbToHsl(r, g, b)
      return [Math.round(hsl.h), Math.round(hsl.s * 100), Math.round(hsl.l * 100)]
    },
    write: (index, n, { r, g, b }) => {
      const hsl = rgbToHsl(r, g, b)
      const h = index === 0 ? n : hsl.h
      const s = index === 1 ? n / 100 : hsl.s
      const l = index === 2 ? n / 100 : hsl.l
      return rgbToHsvKeepingHue(hslToRgb(h, clamp01(s), clamp01(l)), h)
    },
  },
  oklch: {
    channels: [
      { label: "Lightness", ...PERCENT, inputMode: "decimal" },
      {
        label: "Chroma",
        min: 0,
        max: 0.4,
        decimals: 2,
        step: 0.01,
        largeStep: 0.1,
        inputMode: "decimal",
      },
      { label: "Hue", ...DEGREES },
    ],
    read: ({ r, g, b }, color) => {
      const oklch = rgbToOklch(r, g, b)
      return [
        Number((oklch.L * 100).toFixed(0)),
        Number(oklch.C.toFixed(2)),
        Number((color.oklchH ?? oklch.H).toFixed(0)),
      ]
    },
    write: (index, n, { r, g, b }, color) => {
      const cur = rgbToOklch(r, g, b)
      const L = index === 0 ? n / 100 : cur.L
      const C = index === 1 ? n : cur.C
      // L and C edits anchor on the user's last stated H, so hue doesn't drift along with them.
      const H = index === 2 ? n : (color.oklchH ?? cur.H)
      const rgb = oklchToRgb(clamp01(L), Math.max(0, C), H)
      return { ...rgbToHsvKeepingHue(rgb, color.h), oklchH: H }
    },
  },
}

const ALPHA_CHANNEL: ChannelSpec = { label: "Alpha", ...PERCENT, percent: true }

function ChannelInput(props: ChannelSpec & { value: number; onCommit: (n: number) => void }) {
  return (
    <ChannelTooltip label={props.label}>
      <ScrubInput {...props} />
    </ChannelTooltip>
  )
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
        "flex cursor-pointer items-center justify-center px-3 text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted",
        CONTROL_CLASS,
        SHAPE.input,
      )}
    >
      <IconColorPicker className="size-4" />
    </button>
  )
}

// ---------------------------------------------------------------------------
// ColorPicker (panel)
// ---------------------------------------------------------------------------

function ColorPicker({
  value,
  defaultValue = DEFAULT_VALUE,
  onValueChange,
  format,
  defaultFormat = "hex",
  onFormatChange,
  hideEyedropper,
  className,
  ref,
  ...props
}: ColorPickerProps) {
  const [internalFormat, setInternalFormat] = useState<ColorFormat>(defaultFormat)
  const currentFormat = format ?? internalFormat

  // Seeded from the initial value only; later controlled values arrive through the effect.
  const [color, setColor] = useState<ColorState>(() => {
    const p = parseColor(value ?? defaultValue)
    if (!p) return { h: 0, s: 1, v: 1, a: 1, oklchH: null }
    return { ...rgbToHsvKeepingHue(p, 0), a: p.a, oklchH: null }
  })

  // External sync — when a controlled value changes from outside, re-seed the state. Our own
  // value coming back is skipped, since it would round-trip and fight the drag; the marker is
  // spent on that echo, so a later outside change back to the same string (an undo) applies.
  const lastEmittedRef = useRef<string | null>(null)
  useEffect(() => {
    if (value === undefined) return
    if (value === lastEmittedRef.current) {
      lastEmittedRef.current = null
      return
    }
    const p = parseColor(value)
    if (!p) return
    // oxlint-disable-next-line react/set-state-in-effect -- syncs the internal state with the controlled value prop
    setColor((prev) => ({ ...rgbToHsvKeepingHue(p, prev.h), a: p.a, oklchH: null }))
  }, [value])

  const emit = (next: ColorState, fmt: ColorFormat) => {
    const formatted = formatColor(next, fmt)
    lastEmittedRef.current = formatted
    onValueChange?.(formatted)
  }

  const update = (patch: Partial<ColorState>) => {
    const merged = { ...color, ...patch }
    const moved = merged.h !== color.h || merged.s !== color.s || merged.v !== color.v
    const next = moved && !("oklchH" in patch) ? { ...merged, oklchH: null } : merged
    // Slider steps and repeated commits often land on the colour we already have.
    if (isSameState(next, color)) return
    setColor(next)
    emit(next, currentFormat)
  }

  const handleFormatChange = (f: ColorFormat) => {
    if (format === undefined) setInternalFormat(f)
    onFormatChange?.(f)
    emit(color, f)
  }

  const commitColor = (input: string) => {
    const p = parseColor(input)
    if (!p) return
    update({ ...rgbToHsvKeepingHue(p, color.h), a: p.a })
  }

  const rgb = roundedRgb(color)
  const alpha = (
    <ChannelInput
      {...ALPHA_CHANNEL}
      value={Math.round(color.a * 100)}
      onCommit={(n) => update({ a: clamp01(n / 100) })}
    />
  )

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
      <SaturationSquare
        h={color.h}
        s={color.s}
        v={color.v}
        color={`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`}
        onChange={(s, v) => update({ s, v })}
      />

      <div className="flex flex-col gap-1">
        <HueSlider h={color.h} onChange={(h) => update({ h })} />
        <AlphaSlider a={color.a} rgb={rgb} onChange={(a) => update({ a })} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <FormatDropdown value={currentFormat} onChange={handleFormatChange} />
        {!hideEyedropper && <EyeDropperButton onPick={commitColor} />}
      </div>

      {currentFormat === "hex" ? (
        <div className="grid grid-cols-2 gap-2">
          <ChannelTooltip label="Hex">
            <HexInput
              value={rgbToHexStr(rgb.r, rgb.g, rgb.b, color.a).slice(1).toUpperCase()}
              onCommit={(next) => commitColor(next.startsWith("#") ? next : `#${next}`)}
            />
          </ChannelTooltip>
          {alpha}
        </div>
      ) : (
        <ChannelRow
          model={CHANNEL_MODELS[currentFormat]}
          rgb={rgb}
          color={color}
          onPatch={update}
          alpha={alpha}
        />
      )}
    </div>
  )
}

function ChannelRow({
  model,
  rgb,
  color,
  onPatch,
  alpha,
}: {
  model: ChannelModel
  rgb: Rgb
  color: ColorState
  onPatch: (patch: Partial<ColorState>) => void
  alpha: ReactNode
}) {
  const values = model.read(rgb, color)
  return (
    <div className="grid grid-cols-4 gap-1">
      {model.channels.map((channel, i) => (
        <ChannelInput
          key={channel.label}
          {...channel}
          value={values[i]!}
          onCommit={(n) => onPatch(model.write(i, n, rgb, color))}
        />
      ))}
      {alpha}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ColorPickerPopover (trigger button + popover panel)
//
// Base UI's Popover owns positioning (anchor tracking + collision flipping), dismissal and
// focus management; `useSpringPopup` adds the spring open/close.
// ---------------------------------------------------------------------------

function ColorPickerPopover({
  triggerLabel,
  triggerShowValue = true,
  triggerClassName,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  container,
  value,
  defaultValue = DEFAULT_VALUE,
  onValueChange,
  ...pickerProps
}: ColorPickerPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const open = openProp ?? internalOpen
  const { actionsRef, motionProps } = useSpringPopup(open, spring.moderate)
  const [panelEl, setPanelEl] = useState<HTMLDivElement | null>(null)

  // The trigger swatch needs the current value too, so the popover keeps its own copy when
  // uncontrolled and hands the panel a controlled value.
  const [internalValue, setInternalValue] = useState(defaultValue)
  const currentValue = value ?? internalValue

  const parsed = useMemo(() => parseColor(currentValue), [currentValue])
  const swatchColor = parsed ? rgbToHexStr(parsed.r, parsed.g, parsed.b, parsed.a) : currentValue
  const valueLabel = parsed
    ? rgbToHexStr(parsed.r, parsed.g, parsed.b, 1).slice(1).toUpperCase()
    : currentValue
  const swatchOnly = !triggerLabel && !triggerShowValue

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (openProp === undefined) setInternalOpen(next)
        onOpenChange?.(next)
      }}
      actionsRef={actionsRef}
      // Non-modal: the page keeps scrolling and the Positioner tracks the anchor, so the
      // panel follows its trigger instead of detaching.
      modal={false}
    >
      <div className="inline-flex">
        <Popover.Trigger
          // With nothing printed, the value becomes the button's name.
          aria-label={swatchOnly ? `Color ${valueLabel}` : undefined}
          className={cn(
            "flex cursor-pointer items-center gap-2 border border-border px-2 text-[13px] font-medium hover:bg-muted",
            CONTROL_CLASS,
            SHAPE.input,
            // A lone swatch sits in a square box, so the gap around it is the same on all four
            // sides whatever height the caller picks.
            swatchOnly && "aspect-square justify-center px-0",
            triggerClassName,
          )}
        >
          {triggerLabel && (
            <span className="px-1 text-muted-foreground select-none">{triggerLabel}</span>
          )}
          <span
            className={cn("relative inline-block size-5 shrink-0 overflow-hidden", SHAPE.bg)}
            style={{ ...CHECKER_BG, boxShadow: "inset 0 0 0 1px rgba(127,127,127,0.25)" }}
          >
            <span className="absolute inset-0" style={{ backgroundColor: swatchColor }} />
          </span>
          {triggerShowValue && <span className="text-foreground tabular-nums">{valueLabel}</span>}
        </Popover.Trigger>
        <Popover.Portal container={container ?? undefined}>
          {/* pointer-events-auto: see the format menu's positioner — the subtitles panel's
              shadow host is pointer-events:none so clicks fall through to the video. */}
          <Popover.Positioner
            side="bottom"
            align="start"
            sideOffset={6}
            className="pointer-events-auto z-50 outline-none"
          >
            <motion.div {...motionProps} style={{ transformOrigin: "top left" }}>
              <Popover.Popup
                ref={setPanelEl}
                data-slot="color-picker-content"
                className="outline-none"
              >
                <PortalContainerContext value={panelEl}>
                  <ColorPicker
                    {...pickerProps}
                    value={currentValue}
                    onValueChange={(v) => {
                      if (value === undefined) setInternalValue(v)
                      onValueChange?.(v)
                    }}
                    className="shadow-lg"
                  />
                </PortalContainerContext>
              </Popover.Popup>
            </motion.div>
          </Popover.Positioner>
        </Popover.Portal>
      </div>
    </Popover.Root>
  )
}

export { ColorPicker, ColorPickerPopover }

export type { ColorFormat, ColorPickerPopoverProps, ColorPickerProps }
