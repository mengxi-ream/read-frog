"use client"

import type { MotionValue } from "motion/react"
import type { CSSProperties, HTMLAttributes, PointerEvent as ReactPointerEvent, Ref } from "react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { animate, AnimatePresence, motion, useMotionValue, useTransform } from "motion/react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { spring } from "@/utils/styles/springs"
import { cn } from "@/utils/styles/utils"

/* Upstream is written against a token set this project doesn't have (`--active`,
   `--focus-ring`, bare `--foreground`). Our palette lives under `@theme inline`, which
   compiles `--color-*` into the utilities rather than emitting them as custom
   properties — so a runtime `var(--color-foreground)` resolves to nothing. Inline
   styles have to read the `--rf-*` originals, which are declared on `:root` and so
   inherit into the shadow roots the content scripts render into.

   `--active` has no equivalent, so the fill borrows `--rf-muted`: subtle enough that
   a label sitting on top of it stays readable. That leaves the hover preview needing a
   different tint — at 40% muted it would vanish wherever it overlaps the fill — so it
   shifts to a muted-foreground wash that reads on filled and unfilled track alike. */
const FILL_COLOR = "var(--rf-muted)"
const HOVER_PREVIEW_COLOR = "color-mix(in srgb, var(--rf-muted-foreground) 20%, transparent)"
const FOCUS_RING_COLOR = "var(--rf-ring)"

type SliderValue = number | [number, number]
type ValuePosition = "left" | "right" | "top" | "bottom" | "tooltip"

interface SliderProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  ref?: Ref<HTMLDivElement>
  value: SliderValue
  onChange: (value: SliderValue) => void
  /** Fires once per interaction, on release — for writes too expensive to run per frame. */
  onCommit?: (value: SliderValue) => void
  min?: number
  max?: number
  step?: number
  /**
   * Discrete list of allowed values, e.g. [0.1, 0.5, 0.7, 1.1, 1.3].
   *
   * When set, the thumb snaps only to these values (positioned proportionally
   * along the track) and arrow keys walk the list. `min`/`max` derive from the
   * list's extremes and `step` is ignored.
   */
  steps?: number[]
  showSteps?: boolean
  showValue?: boolean
  valuePosition?: ValuePosition
  formatValue?: (v: number) => string
  label?: string
  disabled?: boolean
  trackClassName?: string
  trackStyle?: CSSProperties
  fillClassName?: string
  fillStyle?: CSSProperties
  hideFill?: boolean
  thumbColor?: string
  thumbBorderColor?: string
}

const THUMB_SIZE = 20
const THUMB_SIZE_REST = 16
const TRACK_BG_HEIGHT = 18
const DOT_SIZE = 4
// Inset track BG so its rounded-end centers align with thumb centers at min/max
const TRACK_INSET = (THUMB_SIZE - TRACK_BG_HEIGHT) / 2

function valueToPixel(v: number, min: number, max: number, trackWidth: number): number {
  if (max === min) return 0
  const usable = trackWidth - THUMB_SIZE
  return ((v - min) / (max - min)) * usable
}

/* `noUncheckedIndexedAccess` is on, but every index read in the geometry below is
   in range by construction — clamped against `length`, or 0 on an array the caller
   has already proven non-empty. One accessor keeps that invariant in a single place
   instead of scattering non-null assertions through the math. */
function at(values: readonly number[], index: number): number {
  return values[index] as number
}

function nearestStepIndex(v: number, steps: number[]): number {
  let idx = 0
  for (let i = 1; i < steps.length; i++) {
    if (Math.abs(at(steps, i) - v) < Math.abs(at(steps, idx) - v)) idx = i
  }
  return idx
}

function pixelToValue(
  px: number,
  min: number,
  max: number,
  step: number,
  trackWidth: number,
  stepValues: number[] | null = null,
): number {
  const usable = trackWidth - THUMB_SIZE
  if (usable <= 0) return min
  const raw = (px / usable) * (max - min) + min
  if (stepValues) return at(stepValues, nearestStepIndex(raw, stepValues))
  const snapped = Math.round((raw - min) / step) * step + min
  return Math.max(min, Math.min(max, snapped))
}

function toThumbValues(value: SliderValue): number[] {
  return Array.isArray(value) ? value : [value]
}

interface ValueDisplayProps {
  values: number[]
  editingIndex: number | null
  onStartEdit: (index: number) => void
  onCommitEdit: (index: number, v: number) => void
  onCancelEdit: () => void
  min: number
  max: number
  step: number
  stepValues: number[] | null
  formatValue: (v: number) => string
  label?: string
  isRange: boolean
}

function ValueDisplay({
  values,
  editingIndex,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  min,
  max,
  step,
  stepValues,
  formatValue,
  label,
  isRange,
}: ValueDisplayProps) {
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingIndex !== null) {
      // eslint-disable-next-line react/set-state-in-effect
      setInputValue(String(at(values, editingIndex)))
      requestAnimationFrame(() => inputRef.current?.select())
    }
    // Re-running on every `values` change would clobber what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingIndex])

  const commitEdit = useCallback(
    (index: number) => {
      const parsed = Number.parseFloat(inputValue)
      if (Number.isNaN(parsed)) {
        onCancelEdit()
        return
      }
      const clamped = Math.max(min, Math.min(max, parsed))
      const snapped = stepValues
        ? at(stepValues, nearestStepIndex(clamped, stepValues))
        : Math.round((clamped - min) / step) * step + min
      onCommitEdit(index, snapped)
    },
    [inputValue, min, max, step, stepValues, onCommitEdit, onCancelEdit],
  )

  const renderValue = (index: number) => {
    if (editingIndex === index) {
      return (
        <span className="inline-grid text-[13px]">
          {/* Ghost for layout stability — widest possible value */}
          <span className="invisible col-start-1 row-start-1" aria-hidden="true">
            {label ? `${label}: ` : ""}
            {formatValue(max)}
          </span>
          <span className="col-start-1 row-start-1 flex items-center gap-1">
            {label && <span className="text-muted-foreground">{label}:</span>}
            <input
              ref={inputRef}
              type="number"
              value={inputValue}
              min={min}
              max={max}
              step={stepValues ? "any" : step}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={() => commitEdit(index)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit(index)
                if (e.key === "Escape") onCancelEdit()
              }}
              aria-label={`Edit slider value${isRange ? (index === 0 ? " (start)" : " (end)") : ""}`}
              className="w-[5ch] border-b border-border bg-transparent text-center text-foreground outline-none"
            />
          </span>
        </span>
      )
    }

    return (
      <span className="cursor-text select-none" onClick={() => onStartEdit(index)}>
        {formatValue(at(values, index))}
      </span>
    )
  }

  const widestValue = isRange
    ? `${label ? `${label}: ` : ""}${formatValue(max)} — ${formatValue(max)}`
    : `${label ? `${label}: ` : ""}${formatValue(max)}`

  return (
    <span className="inline-grid shrink-0 text-[13px] leading-none text-muted-foreground tabular-nums">
      {/* Invisible ghost — reserves width of widest possible value */}
      <span className="invisible col-start-1 row-start-1 whitespace-nowrap" aria-hidden="true">
        {widestValue}
      </span>
      <span className="col-start-1 row-start-1 whitespace-nowrap">
        {label && editingIndex === null && <span className="text-muted-foreground">{label}: </span>}
        {isRange ? (
          <>
            {renderValue(0)}
            <span className="mx-1 text-muted-foreground/50">—</span>
            {renderValue(1)}
          </>
        ) : (
          renderValue(0)
        )}
      </span>
    </span>
  )
}

interface TooltipValueProps {
  value: number
  formatValue: (v: number) => string
  motionX: MotionValue<number>
}

function TooltipValue({ value, formatValue, motionX }: TooltipValueProps) {
  const tooltipX = useTransform(motionX, (x) => x + THUMB_SIZE / 2)
  return (
    <motion.div
      className="pointer-events-none absolute z-20 -translate-x-1/2"
      style={{ x: tooltipX, top: -16 }}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4, transition: spring.fast.exit }}
      transition={spring.fast}
    >
      <span className="rounded-md bg-foreground px-2 py-1 text-[12px] whitespace-nowrap text-background tabular-nums">
        {formatValue(value)}
      </span>
    </motion.div>
  )
}

function Slider({
  ref,
  value,
  onChange,
  onCommit,
  min: minProp = 0,
  max: maxProp = 100,
  step = 1,
  steps,
  showSteps = false,
  showValue = false,
  valuePosition = "left",
  formatValue = String,
  label,
  disabled = false,
  trackClassName,
  trackStyle,
  fillClassName,
  fillStyle,
  hideFill = false,
  thumbColor,
  thumbBorderColor,
  className,
  ...props
}: SliderProps) {
  const isRange = Array.isArray(value)
  const values = toThumbValues(value)

  // Non-uniform step mode: sorted, deduped list of allowed values. Keyed on
  // the joined string so inline array literals don't recompute every render.
  const stepsKey = steps ? steps.join(",") : ""
  const stepValues = useMemo(() => {
    if (!stepsKey) return null
    const parsed = Array.from(new Set(stepsKey.split(",").map(Number))).sort((a, b) => a - b)
    return parsed.length > 1 ? parsed : null
  }, [stepsKey])
  const min = stepValues ? at(stepValues, 0) : minProp
  const max = stepValues ? at(stepValues, stepValues.length - 1) : maxProp

  const trackRef = useRef<HTMLDivElement>(null)
  const trackWidthRef = useRef(0)
  const dragging = useRef(false)
  const activeDragThumb = useRef<number>(0)
  const valuesRef = useRef(values)
  const minRef = useRef(min)
  const maxRef = useRef(max)
  valuesRef.current = values
  minRef.current = min
  maxRef.current = max

  const [isHovered, setIsHovered] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [hoverPreview, setHoverPreview] = useState<{
    left: number
    width: number
    snappedValue: number
    cursorX: number
  } | null>(null)
  const [focusedThumb, setFocusedThumb] = useState<number | null>(null)
  const [showHoverTooltip, setShowHoverTooltip] = useState(false)
  const hoverDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Show hover tooltip after 100ms delay
  useEffect(() => {
    if (isHovered) {
      hoverDelayRef.current = setTimeout(() => setShowHoverTooltip(true), 100)
    } else {
      if (hoverDelayRef.current) clearTimeout(hoverDelayRef.current)
      setShowHoverTooltip(false)
    }
    return () => {
      if (hoverDelayRef.current) clearTimeout(hoverDelayRef.current)
    }
  }, [isHovered])

  const motionX0 = useMotionValue(0)
  const motionX1 = useMotionValue(0)

  const fillLeft = useTransform(motionX0, (x) => (isRange ? x + THUMB_SIZE / 2 - TRACK_INSET : 0))
  const fillWidthSingle = useTransform(motionX0, (x) => x + THUMB_SIZE / 2 - TRACK_INSET)
  const fillWidthRange = useTransform(
    [motionX0, motionX1] as MotionValue<number>[],
    ([x0, x1]) => (x1 as number) - (x0 as number),
  )
  const fillWidth = isRange ? fillWidthRange : fillWidthSingle

  // Step dots mask (hides dots on filled side, like SliderComfortable pips)
  const stepDotsMaskSingle = useTransform(motionX0, (x) => {
    const edge = x + THUMB_SIZE / 2
    return `linear-gradient(to right, transparent ${edge}px, black ${edge + 2}px)`
  })
  const stepDotsMaskRange = useTransform(
    [motionX0, motionX1] as MotionValue<number>[],
    ([x0, x1]) => {
      const left = (x0 as number) + THUMB_SIZE / 2
      const right = (x1 as number) + THUMB_SIZE / 2
      return `linear-gradient(to right, black ${left - 2}px, transparent ${left}px, transparent ${right}px, black ${right + 2}px)`
    },
  )
  const stepDotsMask = isRange ? stepDotsMaskRange : stepDotsMaskSingle

  const computeHoverPreview = useCallback(
    (cursorX: number, trackWidth: number) => {
      // cursorX and trackWidth are in layout space (offsetWidth-relative),
      // unaffected by ancestor CSS transforms. THUMB_SIZE / TRACK_INSET are
      // also layout-space, so the math below is consistent end-to-end.
      const usable = trackWidth - THUMB_SIZE
      const rawPx = cursorX - THUMB_SIZE / 2
      const clampedPx = Math.max(0, Math.min(usable, rawPx))
      const rawVal = usable > 0 ? (clampedPx / usable) * (max - min) + min : min
      const snappedVal = stepValues
        ? at(stepValues, nearestStepIndex(rawVal, stepValues))
        : Math.max(min, Math.min(max, Math.round((rawVal - min) / step) * step + min))
      const snappedPercent = max === min ? 0 : (snappedVal - min) / (max - min)
      const snappedX = THUMB_SIZE / 2 + snappedPercent * usable

      // Find nearest thumb center
      const c0 = motionX0.get() + THUMB_SIZE / 2
      const c1 = motionX1.get() + THUMB_SIZE / 2
      const nearestIdx = isRange ? (Math.abs(snappedX - c0) <= Math.abs(snappedX - c1) ? 0 : 1) : 0
      const nearest = nearestIdx === 0 ? c0 : c1

      // Extend hover bar to track edges at extremes so there's no gap
      const edgeX = snappedVal === min ? 0 : snappedVal === max ? trackWidth : snappedX
      const left = Math.min(nearest, edgeX)
      const width = Math.abs(edgeX - nearest)
      setHoverPreview({ left, width, snappedValue: snappedVal, cursorX: snappedX })
    },
    [min, max, step, stepValues, isRange, motionX0, motionX1],
  )

  const initialSyncDone = useRef(false)
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el || initialSyncDone.current) return
    const w = el.offsetWidth
    trackWidthRef.current = w
    motionX0.set(valueToPixel(at(values, 0), min, max, w))
    if (isRange && values[1] !== undefined) {
      motionX1.set(valueToPixel(values[1], min, max, w))
    }
    initialSyncDone.current = true
    // eslint-disable-next-line react/set-state-in-effect
    setReady(true)
    // Runs once, before first paint, off whatever the initial props were.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Track width measurement (resize only)
  useEffect(() => {
    const el = trackRef.current
    if (!el) return undefined
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return
      const w = entry.contentRect.width
      trackWidthRef.current = w
      if (!dragging.current && initialSyncDone.current) {
        const v = valuesRef.current
        const mn = minRef.current
        const mx = maxRef.current
        animate(motionX0, valueToPixel(at(v, 0), mn, mx, w), spring.moderate)
        if (isRange && v[1] !== undefined) {
          animate(motionX1, valueToPixel(v[1], mn, mx, w), spring.moderate)
        }
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [isRange, motionX0, motionX1])

  // Sync motion values on value change (keyboard, programmatic).
  // Depend on a primitive key rather than the `values` array — its identity
  // changes every render (toThumbValues allocates), which would restart the
  // animation on unrelated re-renders (hover/tooltip state churn).
  const valuesKey = values.join(",")
  useEffect(() => {
    if (!initialSyncDone.current) return
    if (dragging.current) return
    const tw = trackWidthRef.current
    if (tw <= 0) return
    const v = valuesRef.current
    animate(motionX0, valueToPixel(at(v, 0), min, max, tw), spring.moderate)
    if (isRange && v[1] !== undefined) {
      animate(motionX1, valueToPixel(v[1], min, max, tw), spring.moderate)
    }
  }, [valuesKey, min, max, isRange, motionX0, motionX1])

  const clampForRange = useCallback(
    (px: number, thumbIndex: number): number => {
      if (!isRange) return px
      if (thumbIndex === 0) return Math.min(px, motionX1.get() - THUMB_SIZE * 0.5)
      return Math.max(px, motionX0.get() + THUMB_SIZE * 0.5)
    },
    [isRange, motionX0, motionX1],
  )

  const composeValue = useCallback(
    (thumbIndex: number, newValue: number): SliderValue => {
      if (!isRange) return newValue
      const next: [number, number] = [...(values as [number, number])]
      next[thumbIndex] = newValue
      return next
    },
    [isRange, values],
  )

  const emitChange = useCallback(
    (thumbIndex: number, newValue: number) => {
      onChange(composeValue(thumbIndex, newValue))
    },
    [composeValue, onChange],
  )

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return
      if (e.pointerType === "mouse" && e.button !== 0) return
      e.preventDefault()
      e.stopPropagation() // Prevent the primitive from also handling the drag

      const trackEl = trackRef.current
      if (!trackEl) return
      const trackRect = trackEl.getBoundingClientRect()
      const layoutWidth = trackEl.offsetWidth
      if (layoutWidth <= 0 || trackRect.width <= 0) return
      // Normalize cursor to layout space so it matches motionX (which is
      // rendered as a CSS-pixel transform), even under ancestor CSS scale.
      const scale = trackRect.width / layoutWidth
      const localX = (e.clientX - trackRect.left) / scale - THUMB_SIZE / 2
      const clamped = Math.max(0, Math.min(layoutWidth - THUMB_SIZE, localX))

      if (isRange) {
        const dist0 = Math.abs(clamped - motionX0.get())
        const dist1 = Math.abs(clamped - motionX1.get())
        activeDragThumb.current = dist0 <= dist1 ? 0 : 1
      } else {
        activeDragThumb.current = 0
      }

      dragging.current = true
      setIsPressed(true)

      const motionX = activeDragThumb.current === 0 ? motionX0 : motionX1

      // Snap to step grid immediately
      const snappedValue = pixelToValue(clamped, min, max, step, layoutWidth, stepValues)
      const snappedPx = valueToPixel(snappedValue, min, max, layoutWidth)
      const finalPx = clampForRange(snappedPx, activeDragThumb.current)
      animate(motionX, finalPx, spring.moderate)

      emitChange(
        activeDragThumb.current,
        pixelToValue(finalPx, min, max, step, layoutWidth, stepValues),
      )
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [disabled, isRange, min, max, step, stepValues, motionX0, motionX1, clampForRange, emitChange],
  )

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      e.stopPropagation()
      const trackEl = trackRef.current
      if (!trackEl) return
      const trackRect = trackEl.getBoundingClientRect()
      const layoutWidth = trackEl.offsetWidth
      if (layoutWidth <= 0 || trackRect.width <= 0) return
      const scale = trackRect.width / layoutWidth
      const localX = (e.clientX - trackRect.left) / scale - THUMB_SIZE / 2
      const clamped = Math.max(0, Math.min(layoutWidth - THUMB_SIZE, localX))

      const motionX = activeDragThumb.current === 0 ? motionX0 : motionX1

      const snappedValue = pixelToValue(clamped, min, max, step, layoutWidth, stepValues)
      const snappedPx = valueToPixel(snappedValue, min, max, layoutWidth)
      const finalPx = clampForRange(snappedPx, activeDragThumb.current)
      motionX.set(finalPx)

      emitChange(
        activeDragThumb.current,
        pixelToValue(finalPx, min, max, step, layoutWidth, stepValues),
      )
    },
    [min, max, step, stepValues, motionX0, motionX1, clampForRange, emitChange],
  )

  const handlePointerUp = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    setIsPressed(false)
    setHoverPreview(null)

    // Spring settle to final quantized position
    const tw = trackWidthRef.current
    const motionX = activeDragThumb.current === 0 ? motionX0 : motionX1
    const snapped = pixelToValue(motionX.get(), min, max, step, tw, stepValues)
    animate(motionX, valueToPixel(snapped, min, max, tw), spring.moderate)
    onCommit?.(composeValue(activeDragThumb.current, snapped))
  }, [min, max, step, stepValues, motionX0, motionX1, onCommit, composeValue])

  // In steps mode the primitive runs on indices (0..len-1, step 1) so arrow
  // keys walk the list; map indices back to actual values on the way out.
  const fromPrimitiveValues = useCallback(
    (newValues: number[]): SliderValue => {
      const mapped = stepValues ? newValues.map((i) => at(stepValues, Math.round(i))) : newValues
      return isRange ? (mapped as [number, number]) : at(mapped, 0)
    },
    [isRange, stepValues],
  )

  const handlePrimitiveChange = useCallback(
    (newValues: number[]) => {
      if (dragging.current) return
      onChange(fromPrimitiveValues(newValues))
    },
    [onChange, fromPrimitiveValues],
  )

  const handlePrimitiveCommit = useCallback(
    (newValues: number[]) => {
      // Pointer commits are emitted by handlePointerUp — the primitive is
      // pointer-events:none, so anything reaching here came from the keyboard.
      if (dragging.current) return
      onCommit?.(fromPrimitiveValues(newValues))
    },
    [onCommit, fromPrimitiveValues],
  )

  const handleStartEdit = useCallback((index: number) => setEditingIndex(index), [])

  const handleCommitEdit = useCallback(
    (index: number, v: number) => {
      emitChange(index, v)
      onCommit?.(composeValue(index, v))
      setEditingIndex(null)
    },
    [emitChange, onCommit, composeValue],
  )

  const handleCancelEdit = useCallback(() => setEditingIndex(null), [])

  const stepDots = useMemo(() => {
    if (!showSteps) return []
    if (stepValues) {
      return stepValues.map((v) => ({
        value: v,
        percent: max === min ? 0 : (v - min) / (max - min),
      }))
    }
    return Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => {
      const v = min + i * step
      return { value: v, percent: (v - min) / (max - min) }
    })
  }, [showSteps, min, max, step, stepValues])

  const isInteracting = isHovered || isPressed

  // aria-label on Root lands on a role-less div and never reaches the thumb's
  // input, so each Thumb gets its own label.
  const thumbAriaLabel = (index: number): string | undefined => {
    if (!isRange) return label
    if (!label) return index === 0 ? "Minimum" : "Maximum"
    return index === 0 ? `${label} minimum` : `${label} maximum`
  }

  const valueDisplay = showValue && valuePosition !== "tooltip" && (
    <ValueDisplay
      values={values}
      editingIndex={editingIndex}
      onStartEdit={handleStartEdit}
      onCommitEdit={handleCommitEdit}
      onCancelEdit={handleCancelEdit}
      min={min}
      max={max}
      step={step}
      stepValues={stepValues}
      formatValue={formatValue}
      label={label}
      isRange={isRange}
    />
  )

  const renderVisualThumb = (index: number) => {
    const motionX = index === 0 ? motionX0 : motionX1
    return (
      <motion.span
        key={`visual-thumb-${index}`}
        className="pointer-events-none flex items-center justify-center"
        style={{
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          marginTop: -THUMB_SIZE / 2,
          x: motionX,
          position: "absolute",
          top: "50%",
          left: 0,
          zIndex: 10,
        }}
        initial={false}
      >
        <motion.span
          className="block rounded-full"
          initial={false}
          animate={{ width: THUMB_SIZE_REST, height: THUMB_SIZE_REST }}
          transition={spring.fast}
          style={{
            backgroundColor: thumbColor ?? "white",
            boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            border: thumbBorderColor ? `1px solid ${thumbBorderColor}` : undefined,
          }}
        />
        {/* Focus ring */}
        <motion.span
          className="pointer-events-none absolute rounded-full border"
          initial={false}
          animate={{
            opacity: focusedThumb === index ? 1 : 0,
            width: THUMB_SIZE + 4,
            height: THUMB_SIZE + 4,
          }}
          transition={spring.fast}
          style={{ borderColor: FOCUS_RING_COLOR }}
        />
      </motion.span>
    )
  }

  return (
    <div
      ref={ref}
      className={cn(
        "flex w-full touch-none flex-col gap-0 overflow-visible select-none",
        valuePosition === "left" || valuePosition === "right"
          ? "mb-2 flex-row items-center gap-2"
          : "flex-col",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...props}
    >
      {(valuePosition === "top" || valuePosition === "left") && valueDisplay}

      <div
        className="relative flex-1 overflow-visible"
        style={{
          height:
            valuePosition === "left" || valuePosition === "right"
              ? THUMB_SIZE + 16
              : THUMB_SIZE + (valuePosition === "tooltip" ? 16 : 0),
          paddingTop: valuePosition === "tooltip" ? 16 : 0,
        }}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => {
          setIsHovered(false)
          setHoverPreview(null)
        }}
        onMouseMove={(e) => {
          if (dragging.current) return
          const trackEl = trackRef.current
          if (!trackEl) return
          const trackRect = trackEl.getBoundingClientRect()
          const layoutWidth = trackEl.offsetWidth
          if (layoutWidth <= 0 || trackRect.width <= 0) return
          // Normalize to layout space so the formula's THUMB_SIZE / TRACK_INSET
          // constants (layout px) match the cursor's coordinate space, even when
          // an ancestor applies a CSS scale transform.
          const scale = trackRect.width / layoutWidth
          const layoutX = (e.clientX - trackRect.left) / scale
          computeHoverPreview(Math.max(0, Math.min(layoutWidth, layoutX)), layoutWidth)
        }}
      >
        {showValue && valuePosition === "tooltip" && (
          <AnimatePresence>
            {isInteracting && (
              <TooltipValue
                key="tooltip-0"
                value={at(values, 0)}
                formatValue={formatValue}
                motionX={motionX0}
              />
            )}
            {isInteracting && isRange && values[1] !== undefined && (
              <TooltipValue
                key="tooltip-1"
                value={values[1]}
                formatValue={formatValue}
                motionX={motionX1}
              />
            )}
          </AnimatePresence>
        )}

        {/* Base UI Slider — invisible, provides ARIA + keyboard nav */}
        <SliderPrimitive.Root
          value={stepValues ? values.map((v) => nearestStepIndex(v, stepValues)) : values}
          onValueChange={handlePrimitiveChange}
          onValueCommitted={handlePrimitiveCommit}
          min={stepValues ? 0 : min}
          max={stepValues ? stepValues.length - 1 : max}
          step={stepValues ? 1 : step}
          disabled={disabled}
          className="pointer-events-none absolute inset-0 opacity-0"
          style={{ height: THUMB_SIZE }}
        >
          <SliderPrimitive.Control className="h-full w-full">
            <SliderPrimitive.Track className="h-full w-full">
              <SliderPrimitive.Indicator />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
              index={0}
              aria-label={thumbAriaLabel(0)}
              getAriaValueText={stepValues ? () => formatValue(at(values, 0)) : undefined}
              className="block outline-none"
              style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
              onFocus={(e) => {
                if ((e.currentTarget as HTMLElement).matches(":focus-visible")) setFocusedThumb(0)
              }}
              onBlur={() => setFocusedThumb((prev) => (prev === 0 ? null : prev))}
            />
            {isRange && (
              <SliderPrimitive.Thumb
                index={1}
                aria-label={thumbAriaLabel(1)}
                getAriaValueText={stepValues ? () => formatValue(at(values, 1)) : undefined}
                className="block outline-none"
                style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
                onFocus={(e) => {
                  if ((e.currentTarget as HTMLElement).matches(":focus-visible")) setFocusedThumb(1)
                }}
                onBlur={() => setFocusedThumb((prev) => (prev === 1 ? null : prev))}
              />
            )}
          </SliderPrimitive.Control>
        </SliderPrimitive.Root>

        {/* Visual track with pointer handlers */}
        <div
          ref={trackRef}
          className="relative w-full cursor-ew-resize py-2"
          style={{ height: THUMB_SIZE + 16, opacity: ready ? 1 : 0 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Extended hit area — 8px beyond each edge */}
          <div
            className="absolute cursor-ew-resize"
            style={{ left: -8, right: -8, top: 0, bottom: 0 }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />

          <AnimatePresence>
            {hoverPreview && showHoverTooltip && !isPressed && valuePosition !== "tooltip" && (
              <motion.div
                key="hover-tooltip"
                className="pointer-events-none absolute z-20 -translate-x-1/2"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4, transition: spring.fast.exit }}
                transition={spring.fast}
                style={{ left: hoverPreview.cursorX, top: -20 }}
              >
                <span className="rounded-md bg-foreground px-2 py-1 text-[12px] whitespace-nowrap text-background tabular-nums">
                  {formatValue(hoverPreview.snappedValue)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Track background */}
          <motion.div
            className={cn(
              "absolute overflow-hidden rounded-full border border-border",
              trackClassName,
            )}
            initial={false}
            animate={{
              height: TRACK_BG_HEIGHT,
              top: 8 + (THUMB_SIZE - TRACK_BG_HEIGHT) / 2,
            }}
            transition={spring.fast}
            style={{
              left: TRACK_INSET,
              right: TRACK_INSET,
              backgroundColor: "transparent",
              ...trackStyle,
            }}
          >
            {!hideFill && (
              <motion.div
                className={cn("absolute h-full", fillClassName)}
                style={{
                  left: fillLeft,
                  width: fillWidth,
                  backgroundColor: FILL_COLOR,
                  ...fillStyle,
                }}
              />
            )}

            {/* Hover preview */}
            <motion.div
              className="pointer-events-none absolute z-[2] h-full"
              initial={false}
              animate={{ opacity: hoverPreview && !isPressed ? 1 : 0 }}
              transition={{ opacity: { duration: 0.15 } }}
              style={{
                left: hoverPreview ? hoverPreview.left - TRACK_INSET : 0,
                width: hoverPreview ? hoverPreview.width : 0,
                borderRadius:
                  hoverPreview && hoverPreview.cursorX > hoverPreview.left
                    ? "0 9999px 9999px 0"
                    : "9999px 0 0 9999px",
                backgroundColor: HOVER_PREVIEW_COLOR,
              }}
            />
          </motion.div>

          {/* Step dots — masked so filled side is hidden */}
          {stepDots.length > 0 && (
            <motion.div
              className="pointer-events-none absolute right-0 left-0"
              style={{
                top: 8 + (THUMB_SIZE - TRACK_BG_HEIGHT) / 2,
                height: TRACK_BG_HEIGHT,
                WebkitMaskImage: stepDotsMask,
                maskImage: stepDotsMask,
              }}
            >
              {stepDots.map(({ value: v, percent }) => (
                <div
                  key={v}
                  className="pointer-events-none absolute flex items-center justify-center"
                  style={{
                    left: `calc(${THUMB_SIZE / 2}px + ${percent} * (100% - ${THUMB_SIZE}px))`,
                    top: "50%",
                    width: 0,
                    height: 0,
                  }}
                >
                  <motion.div
                    className="shrink-0 rounded-full"
                    initial={false}
                    animate={{
                      width: isHovered ? DOT_SIZE * 1.25 : DOT_SIZE,
                      height: isHovered ? DOT_SIZE * 1.25 : DOT_SIZE,
                    }}
                    transition={spring.moderate}
                    style={{ backgroundColor: "var(--rf-muted-foreground)", opacity: 0.3 }}
                  />
                </div>
              ))}
            </motion.div>
          )}

          {renderVisualThumb(0)}
          {isRange && renderVisualThumb(1)}
        </div>
      </div>

      {(valuePosition === "bottom" || valuePosition === "right") && valueDisplay}
    </div>
  )
}

type SliderComfortableVariant = "pips" | "scrubber"

interface SliderComfortableProps {
  value: number
  onChange: (value: number) => void
  /** Fires once per interaction, on release — for writes too expensive to run per frame. */
  onCommit?: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** `pips` puts a dot on every step; `scrubber` fills a plain track. */
  variant?: SliderComfortableVariant
  /** Rendered inside the track, and used to name the thumb unless `aria-label` overrides it. */
  label?: string
  /**
   * Names the thumb without rendering anything — for rows where the surrounding
   * layout already shows a visible label.
   */
  "aria-label"?: string
  formatValue?: (v: number) => string
  disabled?: boolean
  /** Applied to the track box, e.g. to give it a background. */
  className?: string
}

/* Pips sit this far in from each wall: 12px of padding plus half a 5px dot. */
const PIP_INSET = 14.5

/* Hides every pip left of the fill's end or of a few px past the grip, whichever
   is further right. The fill ends halfway between pips, so this never cuts one. */
const PIP_MASK =
  "linear-gradient(to right, transparent max(var(--slider-fill), var(--slider-grip) + 6px), black calc(max(var(--slider-fill), var(--slider-grip) + 6px) + 2px))"

/* How far a pip keeps from the label and the value. */
const PIP_TEXT_GAP = 6

/* The thumb is the hit area that drags from where the value is. A pip slider
   wants every press to land on the pip under the pointer instead, so its thumb
   lets presses through. */
const THUMB: Record<SliderComfortableVariant, string> = {
  scrubber: "w-6",
  pips: "pointer-events-none w-px",
}

/* A scrubber's drag tracks the pointer 1:1, so its fill stops easing while
   dragging. A pip slider's fill moves a whole step at a time, which reads better
   eased. Base UI flags a press as dragging from pointerdown, so a scrubber's press
   lands at once too; keys and outside updates ease either way. */
const DRAG_MOTION: Record<SliderComfortableVariant, string> = {
  scrubber: "group-data-dragging/slider:transition-none",
  pips: "",
}

type Geometry = Record<"fill" | "grip" | "anchor", string>

/* Where a value lands along the box, as CSS lengths against the control's padding
   box: where the fill ends, where the 2px grip starts, and where a tooltip for that
   value centres. `steps` is how many steps span the range. */
function geometryFor(
  variant: SliderComfortableVariant,
  steps: number,
): (ratio: number) => Geometry {
  if (variant === "pips") {
    /* The grip marks the value's pip. The fill covers it and stops halfway to the
       next one, so the next pip stays uncovered at any spacing pips suit (about
       10px or more); it is empty at the minimum and full at the maximum. At either
       end the grip steps 2.5px out toward the wall, clear of the label and value. */
    return (ratio) => {
      const next = Math.min(1, ratio + 1 / steps)
      const fill = ratio === 0 ? "0px" : ratio === 1 ? "100%" : pipPosition((ratio + next) / 2)
      const nudge = ratio === 0 ? " - 2.5px" : ratio === 1 ? " + 2.5px" : ""
      return { fill, grip: `calc(${pipPosition(ratio)} - 1px${nudge})`, anchor: pipPosition(ratio) }
    }
  }
  /* The fill is the value's share of the box; the grip rides inside it, a few px
     short of its edge, held clear of the left wall. */
  return (ratio) => {
    const edge = `${ratio * 100}%`
    return { fill: edge, grip: `max(7px, ${edge} - 9px)`, anchor: edge }
  }
}

/* The bordered box is the whole track, the fill is the value, and the label and
   value sit on top of it. Base UI owns the behaviour — pointer and keyboard input,
   ARIA — so everything here is styling, apart from tracking which value the
   pointer hovers over so the box can preview it before a press.

   The thumb has no look of its own: the grip is drawn by the visuals layer, which
   reads the value's position from CSS variables the control sets. */
function SliderComfortable({
  value,
  onChange,
  onCommit,
  min = 0,
  max = 100,
  step = 1,
  variant = "pips",
  label,
  "aria-label": ariaLabel,
  formatValue = String,
  disabled = false,
  className,
}: SliderComfortableProps) {
  const [hoverValue, setHoverValue] = useState<number>()
  const trackRef = useRef<HTMLDivElement>(null)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(hoverTimeout.current), [])
  /* Base UI 1.8.0 drops the commit of a touch tap: the native touchstart restarts
     the press after pointerdown has already set the value, so pointerup finds
     nothing to commit. A pointer change still uncommitted when the control lets
     go of the pointer is committed here instead. (A mouse press commits first, so
     this stays empty for it.) */
  const uncommitted = useRef<number | null>(null)
  const geometry = geometryFor(variant, (max - min) / step)
  const current = geometry(toRatio(value, min, max))
  const hover = hoverValue === undefined ? undefined : geometry(toRatio(hoverValue, min, max))
  const pips = variant === "pips"
  /* Where the label ends and the value starts, so the pips behind them can be
     left out. Leaving them out rather than painting over them keeps the box
     see-through on any surface. */
  const labelRef = useRef<HTMLDivElement>(null)
  const valueRef = useRef<HTMLOutputElement>(null)
  const [readout, setReadout] = useState<{ width: number; labelEnd: number; valueStart: number }>()
  const hasLabel = Boolean(label)
  useLayoutEffect(() => {
    const valueElement = valueRef.current
    const labelElement = hasLabel ? labelRef.current : null
    const row = valueElement?.parentElement
    if (!pips || !valueElement || !row) return undefined
    const measure = () =>
      setReadout({
        width: row.offsetWidth,
        labelEnd: labelElement ? labelElement.offsetLeft + labelElement.offsetWidth : 0,
        valueStart: valueElement.offsetLeft,
      })
    measure()
    const observer = new ResizeObserver(measure)
    for (const element of [row, valueElement, labelElement]) {
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [pips, hasLabel])

  return (
    <SliderPrimitive.Root
      value={value}
      onValueChange={(next, details) => {
        const pointer = details.reason === "track-press" || details.reason === "drag"
        uncommitted.current = pointer ? next : null
        onChange(next)
      }}
      onValueCommitted={(next) => {
        uncommitted.current = null
        onCommit?.(next)
      }}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className="w-full touch-none select-none data-disabled:pointer-events-none data-disabled:opacity-50"
    >
      {/* Base UI maps a press across the control's content box, so the only
          padding is a pip slider's inset, which lines that box up with the first
          and last pip. Everything drawn is laid out against the padding box. */}
      <SliderPrimitive.Control
        className={cn(
          "group/slider relative h-8 cursor-ew-resize rounded-lg border border-border text-[13px] text-muted-foreground outline outline-offset-2 outline-transparent transition-[color,outline-color] duration-100 before:absolute before:-inset-x-2 before:inset-y-0 hover:text-foreground has-focus-visible:text-foreground has-focus-visible:outline-ring",
          pips && "px-[14.5px]",
          className,
        )}
        style={
          {
            "--slider-fill": current.fill,
            "--slider-grip": current.grip,
            "--slider-hover-fill": hover?.fill,
            "--slider-hover-anchor": hover?.anchor,
          } as CSSProperties
        }
        onLostPointerCapture={() => {
          const pending = uncommitted.current
          uncommitted.current = null
          if (pending !== null) onCommit?.(pending)
        }}
        onPointerEnter={() => clearTimeout(hoverTimeout.current)}
        onPointerLeave={() => {
          /* Drop the preview once the tooltip has faded, so a hidden tooltip left
             parked past the wall can't widen a scrolling ancestor. */
          hoverTimeout.current = setTimeout(() => setHoverValue(undefined), 150)
        }}
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse") return
          /* The track is the box Base UI maps a press across, so measuring it
             keeps the preview and the press in agreement. */
          const track = trackRef.current
          if (!track) return
          const { left, width } = track.getBoundingClientRect()
          setHoverValue(valueAt((event.clientX - left) / width, min, max, step))
        }}
      >
        <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
          {pips && (
            <div className="absolute inset-0" style={{ maskImage: PIP_MASK }}>
              {pipRatios(min, max, step, readout).map((ratio) => (
                <span
                  key={ratio}
                  className="absolute top-1/2 size-[5px] -translate-1/2 rounded-full bg-muted-foreground/30"
                  style={{ left: pipPosition(ratio) }}
                />
              ))}
            </div>
          )}
          <span
            className={cn(
              "absolute inset-y-0 start-0 w-(--slider-fill) bg-muted transition-[width] duration-100 ease-out",
              DRAG_MOTION[variant],
            )}
          />
          {/* The hover preview and its tooltip stay mounted so the first hover
              fades in like every later one. A drag hides them through
              `visibility`, which can't lose to hover's `opacity` on order. */}
          <span
            className="absolute inset-y-0 bg-muted-foreground/20 opacity-0 transition-opacity duration-150 group-hover/slider:opacity-100 group-data-dragging/slider:invisible"
            style={{
              left: "min(var(--slider-fill), var(--slider-hover-fill))",
              width:
                "max(var(--slider-fill) - var(--slider-hover-fill), var(--slider-hover-fill) - var(--slider-fill))",
            }}
          />
          <span
            className={cn(
              "absolute inset-y-2 start-(--slider-grip) w-0.5 rounded-full bg-foreground/25 transition-[left,top,bottom,background-color] duration-100 ease-out group-hover/slider:inset-y-1.75 group-hover/slider:bg-foreground/50 group-has-focus-visible/slider:inset-y-1.75 group-has-focus-visible/slider:bg-foreground",
              DRAG_MOTION[variant],
            )}
          />
        </div>
        <SliderPrimitive.Track ref={trackRef} className="h-full">
          <SliderPrimitive.Thumb
            aria-label={ariaLabel}
            getAriaValueText={(_, thumbValue) => formatValue(thumbValue)}
            className={cn("h-full", THUMB[variant])}
          />
        </SliderPrimitive.Track>
        <div className="pointer-events-none absolute inset-0 flex items-center gap-3 px-4">
          {label && (
            <SliderPrimitive.Label ref={labelRef} className="min-w-0 truncate">
              {label}
            </SliderPrimitive.Label>
          )}
          <SliderPrimitive.Value ref={valueRef} className="ms-auto shrink-0 tabular-nums">
            {() => formatValue(value)}
          </SliderPrimitive.Value>
        </div>
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-full left-(--slider-hover-anchor) mb-2 -translate-x-1/2 translate-y-1 rounded-md bg-foreground px-2 py-1 text-[12px] whitespace-nowrap text-background tabular-nums opacity-0 transition-[opacity,translate] duration-100 group-hover/slider:translate-y-0 group-hover/slider:opacity-100 group-hover/slider:delay-100 group-data-dragging/slider:invisible"
        >
          {hoverValue !== undefined && formatValue(hoverValue)}
        </span>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

function toRatio(value: number, min: number, max: number) {
  return max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0
}

/* Pips spread across the box less an inset at each wall, matching the content box
   Base UI maps a press across. */
function pipPosition(ratio: number) {
  return `calc(${PIP_INSET}px + ${ratio} * (100% - ${2 * PIP_INSET}px))`
}

/* One pip per whole step from `min`. A `max` off that grid gets no pip: a press is
   snapped to the grid, so a pip there could not always be pressed. Keys still
   reach it, and the grip then stands at the wall. Once the label and value have
   been measured, pips that would touch either are left out whole. */
function pipRatios(
  min: number,
  max: number,
  step: number,
  readout?: { width: number; labelEnd: number; valueStart: number },
) {
  const steps = (max - min) / step
  if (!(steps > 0)) return [0]
  const ratios = Array.from({ length: Math.floor(steps + 1e-9) + 1 }, (_, index) => index / steps)
  if (!readout) return ratios
  const { width, labelEnd, valueStart } = readout
  return ratios.filter((ratio) => {
    const center = PIP_INSET + ratio * (width - 2 * PIP_INSET)
    return center - 2.5 >= labelEnd + PIP_TEXT_GAP && center + 2.5 <= valueStart - PIP_TEXT_GAP
  })
}

/* The value a press at `ratio` along the track would set, snapped the way Base UI
   snaps one, so the preview never promises a value the click won't deliver. */
function valueAt(ratio: number, min: number, max: number, step: number) {
  const steps = Math.round((Math.min(1, Math.max(0, ratio)) * (max - min)) / step)
  const decimals = Math.max(decimalPrecision(step), decimalPrecision(min))
  return Math.min(max, Number((min + steps * step).toFixed(decimals)))
}

/* Base UI's own precision rule, which isn't exported: the number of decimals a
   step or bound is written with, so 0.1 * 3 lands on 0.3, not 0.30000000000000004. */
function decimalPrecision(num: number) {
  if (Math.abs(num) < 1 && num !== 0) {
    const [mantissa = "", exponent = "0"] = num.toExponential().split("e-")
    return (mantissa.split(".")[1]?.length ?? 0) + Number.parseInt(exponent, 10)
  }
  return num.toString().split(".")[1]?.length ?? 0
}

export { Slider, SliderComfortable }
export type {
  SliderComfortableProps,
  SliderComfortableVariant,
  SliderProps,
  SliderValue,
  ValuePosition,
}
