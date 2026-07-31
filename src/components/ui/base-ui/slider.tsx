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

   `--active` has no equivalent, so the fill borrows `--rf-accent`: subtle enough that
   a label sitting on top of it stays readable. That leaves the hover preview needing a
   different tint — at 40% accent it would vanish wherever it overlaps the fill — so it
   shifts to a muted-foreground wash that reads on filled and unfilled track alike. */
const FILL_COLOR = "var(--rf-accent)"
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
const PIP_SIZE = 5
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

interface SliderComfortableProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  | "onChange"
  | "defaultValue"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onDragOver"
  | "onAnimationStart"
> {
  ref?: Ref<HTMLDivElement>
  value: number
  onChange: (value: number) => void
  /** Fires once per interaction, on release — for writes too expensive to run per frame. */
  onCommit?: (value: number) => void
  min?: number
  max?: number
  step?: number
  variant?: "pips" | "scrubber"
  /** Rendered inside the track, and used to name the thumb unless `aria-label` overrides it. */
  label?: string
  /**
   * Names the thumb without rendering anything — for rows where the surrounding
   * layout already shows a visible label.
   */
  "aria-label"?: string
  formatValue?: (v: number) => string
  disabled?: boolean
}

function SliderComfortable({
  ref,
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
  ...props
}: SliderComfortableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const handleDragging = useRef(false)
  // Last value emitted during the current drag — `value` can lag a frame behind
  // when the parent batches, and the commit has to report what was released on.
  const latestValue = useRef(value)
  const [isHovered, setIsHovered] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [hoverPreview, setHoverPreview] = useState<{
    left: number
    width: number
    snappedValue: number
    cursorX: number
  } | null>(null)
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

  const mergedRef = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el
      if (typeof ref === "function") ref(el)
      else if (ref) (ref as { current: HTMLDivElement | null }).current = el
    },
    [ref],
  )

  const pipSteps = useMemo(
    () => Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step),
    [min, max, step],
  )
  const pipCount = pipSteps.length

  const fillPercent = useMotionValue(
    max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min))),
  )
  // Small offset when value is at min so the handle line stays visible
  const zeroTarget = variant === "pips" ? 8 : 17
  const zeroOffset = useMotionValue(value === min ? zeroTarget : 0)

  const fillWidthStyle = useTransform(fillPercent, (p) => `${p * 100}%`)
  const handleLeftStyle = useTransform(
    [fillPercent, zeroOffset] as MotionValue<number>[],
    ([p, zo]) => `calc(${(p as number) * 100}% - 8px + ${zo as number}px)`,
  )
  const handleLineLeftStyle = useTransform(
    [fillPercent, zeroOffset] as MotionValue<number>[],
    ([p, zo]) => `calc(${(p as number) * 100}% - 9px + ${zo as number}px)`,
  )
  // Pips-specific: offset by px-3 (12px) padding so fill edge aligns with active pip center
  const pipsFillWidthStyle = useTransform(
    [fillPercent, zeroOffset] as MotionValue<number>[],
    ([p, zo]) =>
      `calc(${(p as number) * 100}% + ${20 - 20 * (p as number) - (zo as number) * 2.5}px)`,
  )
  const pipsHandleLineLeftStyle = useTransform(
    fillPercent,
    (p) => `calc(${p * 100}% + ${11 - 24 * p}px)`,
  )
  const pipsMaskStyle = useTransform(
    [fillPercent, zeroOffset] as MotionValue<number>[],
    ([p, zo]) => {
      const offset = 20 - 20 * (p as number) - (zo as number) * 2.5
      return `linear-gradient(to right, transparent calc(${(p as number) * 100}% + ${offset}px), black calc(${(p as number) * 100}% + ${offset + 2}px))`
    },
  )

  const computeHoverPreview = useCallback(
    (clientX: number) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      // Use clientWidth (padding box) — CSS % and absolute left/width are relative to it
      const w = el.clientWidth
      if (w <= 0 || rect.width <= 0) return
      // Normalize cursor to layout space so it matches `w` (layout, padding box).
      // offsetWidth is the layout border-box; the difference vs `w` is the
      // horizontal border contribution split across both sides.
      const scale = rect.width / el.offsetWidth
      const borderLeftLayout = (el.offsetWidth - w) / 2
      const layoutX = (clientX - rect.left) / scale - borderLeftLayout
      const clamped = Math.max(0, Math.min(w, layoutX))

      let snappedVal: number
      if (variant === "pips") {
        if (pipCount <= 1) return
        const index = Math.max(
          0,
          Math.min(pipCount - 1, Math.round((clamped / w) * (pipCount - 1))),
        )
        snappedVal = at(pipSteps, index)
      } else {
        const raw = min + (clamped / w) * (max - min)
        snappedVal = Math.max(min, Math.min(max, Math.round((raw - min) / step) * step + min))
      }
      const snappedPercent = max === min ? 0 : (snappedVal - min) / (max - min)
      const snappedX = snappedPercent * w

      // Current handle position — for pips, match the visual fill edge offset
      const currentPercent = fillPercent.get()
      const handleX =
        variant === "pips"
          ? currentPercent * w + (20 - 20 * currentPercent - zeroOffset.get() * 2.5)
          : currentPercent * w

      // Extend hover bar to container edges at extremes so there's no gap
      const edgeX = snappedVal === min ? 0 : snappedVal === max ? w : snappedX
      const left = Math.min(handleX, edgeX)
      const width = Math.abs(edgeX - handleX)
      setHoverPreview({ left, width, snappedValue: snappedVal, cursorX: snappedX })
    },
    [variant, pipSteps, pipCount, min, max, step, fillPercent, zeroOffset],
  )

  // Sync fill on programmatic value change
  useEffect(() => {
    latestValue.current = value
    if (dragging.current || handleDragging.current) return
    const percent = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)))
    animate(fillPercent, percent, spring.fast)
    animate(zeroOffset, value === min ? zeroTarget : 0, spring.fast)
  }, [value, min, max, variant, fillPercent, zeroOffset, zeroTarget])

  const getValueFromX = useCallback(
    (clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return min
      const clamped = Math.max(0, Math.min(rect.width, clientX - rect.left))
      if (variant === "pips") {
        if (pipCount <= 1) return min
        const index = Math.max(
          0,
          Math.min(pipCount - 1, Math.round((clamped / rect.width) * (pipCount - 1))),
        )
        return at(pipSteps, index)
      }
      const raw = min + (clamped / rect.width) * (max - min)
      const snapped = Math.round((raw - min) / step) * step + min
      return Math.max(min, Math.min(max, snapped))
    },
    [variant, pipSteps, pipCount, min, max, step],
  )

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return
      if (e.pointerType === "mouse" && e.button !== 0) return
      e.preventDefault()
      dragging.current = true
      setIsPressed(true)
      const newVal = getValueFromX(e.clientX)
      latestValue.current = newVal
      onChange(newVal)
      animate(fillPercent, Math.max(0, Math.min(1, (newVal - min) / (max - min))), spring.fast)
      animate(zeroOffset, newVal === min ? zeroTarget : 0, spring.fast)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [disabled, getValueFromX, onChange, fillPercent, zeroOffset, zeroTarget, min, max],
  )

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      const newVal = getValueFromX(e.clientX)
      latestValue.current = newVal
      onChange(newVal)
      const newPercent = Math.max(0, Math.min(1, (newVal - min) / (max - min)))
      if (variant === "scrubber") fillPercent.set(newPercent)
      else animate(fillPercent, newPercent, spring.fast)
      animate(zeroOffset, newVal === min ? zeroTarget : 0, spring.fast)
    },
    [getValueFromX, onChange, variant, fillPercent, zeroOffset, zeroTarget, min, max],
  )

  const handlePointerUp = useCallback(() => {
    const wasDragging = dragging.current
    dragging.current = false
    setIsPressed(false)
    setHoverPreview(null)
    if (wasDragging) onCommit?.(latestValue.current)
  }, [onCommit])

  // Resize handle drag handlers (direct cursor position)
  const handleResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return
      if (e.pointerType === "mouse" && e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      handleDragging.current = true
      setIsPressed(true)
      const newVal = getValueFromX(e.clientX)
      latestValue.current = newVal
      onChange(newVal)
      fillPercent.set(Math.max(0, Math.min(1, (newVal - min) / (max - min))))
      animate(zeroOffset, newVal === min ? zeroTarget : 0, spring.fast)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [disabled, getValueFromX, onChange, fillPercent, zeroOffset, zeroTarget, min, max],
  )

  const handleResizePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!handleDragging.current) return
      const newVal = getValueFromX(e.clientX)
      latestValue.current = newVal
      onChange(newVal)
      fillPercent.set(Math.max(0, Math.min(1, (newVal - min) / (max - min))))
      animate(zeroOffset, newVal === min ? zeroTarget : 0, spring.fast)
    },
    [getValueFromX, onChange, fillPercent, zeroOffset, zeroTarget, min, max],
  )

  const handleResizePointerUp = useCallback(() => {
    const wasDragging = handleDragging.current
    handleDragging.current = false
    setIsPressed(false)
    setHoverPreview(null)
    if (wasDragging) onCommit?.(latestValue.current)
  }, [onCommit])

  const isActive = isHovered || isFocused

  return (
    <div
      className="relative w-full touch-none"
      onPointerEnter={() => {
        if (!disabled) setIsHovered(true)
      }}
      onPointerLeave={() => {
        if (!disabled) {
          setIsHovered(false)
          setHoverPreview(null)
        }
      }}
      onMouseMove={(e) => {
        if (disabled || dragging.current || handleDragging.current) return
        computeHoverPreview(e.clientX)
      }}
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

      {/* Hover value tooltip — outside overflow-hidden container */}
      <AnimatePresence>
        {hoverPreview && showHoverTooltip && !isPressed && (
          <motion.div
            key="hover-tooltip"
            className="pointer-events-none absolute z-20 -translate-x-1/2"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4, transition: spring.fast.exit }}
            transition={spring.fast}
            style={{ left: hoverPreview.cursorX, top: -30 }}
          >
            <span className="rounded-md bg-foreground px-2 py-1 text-[12px] whitespace-nowrap text-background tabular-nums">
              {formatValue(hoverPreview.snappedValue)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        ref={mergedRef}
        className={cn(
          "relative h-8 w-full touch-none overflow-hidden rounded-lg border border-border outline-offset-2 select-none",
          variant === "scrubber"
            ? "flex cursor-ew-resize items-center gap-3 px-4"
            : "cursor-ew-resize",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        initial={false}
        animate={{
          outline: isFocused ? `1px solid ${FOCUS_RING_COLOR}` : "1px solid transparent",
        }}
        transition={spring.fast}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        {...props}
      >
        {/* Invisible Base UI Slider for keyboard nav + a11y */}
        <SliderPrimitive.Root
          value={[value]}
          onValueChange={(v) => onChange(at(v, 0))}
          onValueCommitted={(v) => {
            // Pointer commits come from the handlers above — the primitive is
            // pointer-events:none, so anything here came from the keyboard.
            if (!dragging.current && !handleDragging.current) onCommit?.(at(v, 0))
          }}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className="pointer-events-none absolute inset-0 opacity-0 [&_*]:pointer-events-none"
        >
          <SliderPrimitive.Control className="h-full w-full">
            <SliderPrimitive.Track className="h-full w-full">
              <SliderPrimitive.Indicator />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
              index={0}
              aria-label={ariaLabel ?? label}
              className="block outline-none"
              onFocus={(e) => {
                if ((e.currentTarget as HTMLElement).matches(":focus-visible")) setIsFocused(true)
              }}
              onBlur={() => setIsFocused(false)}
            />
          </SliderPrimitive.Control>
        </SliderPrimitive.Root>

        {/* Hover preview */}
        <motion.div
          className="pointer-events-none absolute inset-y-0 z-[3]"
          initial={false}
          animate={{ opacity: hoverPreview && !isPressed ? 1 : 0 }}
          transition={{ opacity: { duration: 0.15 } }}
          style={{
            left: hoverPreview ? hoverPreview.left : 0,
            width: hoverPreview ? hoverPreview.width : 0,
            backgroundColor: HOVER_PREVIEW_COLOR,
          }}
        />

        {/* Pips: dots layer — z-[1] */}
        {variant === "pips" && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-between px-3"
            style={{ WebkitMaskImage: pipsMaskStyle, maskImage: pipsMaskStyle }}
          >
            {pipSteps.map((pipValue) => {
              const isActivePip = pipValue === value
              return (
                <div
                  key={pipValue}
                  className="relative flex items-center justify-center"
                  style={{ width: PIP_SIZE, height: PIP_SIZE }}
                >
                  <motion.div
                    className="rounded-full"
                    initial={false}
                    animate={{
                      backgroundColor: isActivePip
                        ? "var(--rf-foreground)"
                        : "var(--rf-muted-foreground)",
                      opacity: isActivePip ? 1 : 0.3,
                    }}
                    transition={spring.fast}
                    style={{ width: PIP_SIZE, height: PIP_SIZE }}
                  />
                </div>
              )
            })}
          </motion.div>
        )}

        {/* Pips: label + value BG layer — z-[2] (occludes dots behind text) */}
        {variant === "pips" && (
          <div
            className="pointer-events-none absolute inset-0 z-[2] flex items-center px-2"
            aria-hidden
          >
            {label && (
              <span className="bg-background px-2 text-[13px] text-transparent select-none">
                {label}
              </span>
            )}
            <span
              className="ml-auto bg-background px-2 text-[13px] text-transparent tabular-nums select-none"
              style={{ minWidth: `${formatValue(max).length}ch` }}
            >
              {formatValue(value)}
            </span>
          </div>
        )}

        {/* Pips: fill — z-[3] */}
        {variant === "pips" && (
          <motion.div
            className="pointer-events-none absolute top-0 bottom-0 left-0 z-[3]"
            style={{ width: pipsFillWidthStyle, backgroundColor: FILL_COLOR }}
          />
        )}

        {/* Pips: handle line — z-[3] */}
        {variant === "pips" && (
          <motion.div
            className="pointer-events-none absolute z-[3] rounded-full"
            initial={false}
            animate={{
              top: isActive ? 7 : 8,
              bottom: isActive ? 7 : 8,
              backgroundColor: isFocused
                ? "var(--rf-foreground)"
                : isHovered
                  ? "color-mix(in srgb, var(--rf-foreground) 50%, transparent)"
                  : "color-mix(in srgb, var(--rf-foreground) 25%, transparent)",
            }}
            transition={spring.fast}
            style={{ left: pipsHandleLineLeftStyle, width: 2 }}
          />
        )}

        {/* Pips: label + value text layer — z-[4] */}
        {variant === "pips" && (
          <div className="pointer-events-none absolute inset-0 z-[4] flex items-center px-2">
            {label && (
              <motion.span
                className="px-2 text-[13px]"
                initial={false}
                animate={{
                  color: isActive ? "var(--rf-foreground)" : "var(--rf-muted-foreground)",
                }}
                transition={spring.fast}
              >
                {label}
              </motion.span>
            )}
            <motion.span
              className="ml-auto px-2 text-[13px] tabular-nums"
              initial={false}
              animate={{
                color: isActive ? "var(--rf-foreground)" : "var(--rf-muted-foreground)",
              }}
              transition={spring.fast}
              style={{ minWidth: `${formatValue(max).length}ch`, textAlign: "right" }}
            >
              {formatValue(value)}
            </motion.span>
          </div>
        )}

        {/* Scrubber: fill */}
        {variant === "scrubber" && (
          <motion.div
            className="pointer-events-none absolute top-0 bottom-0 left-0"
            style={{ width: fillWidthStyle, backgroundColor: FILL_COLOR }}
          />
        )}

        {/* Scrubber: handle line */}
        {variant === "scrubber" && (
          <motion.div
            className="pointer-events-none absolute z-10 rounded-full"
            initial={false}
            animate={{
              top: isActive ? 7 : 8,
              bottom: isActive ? 7 : 8,
              backgroundColor: isFocused
                ? "var(--rf-foreground)"
                : isHovered
                  ? "color-mix(in srgb, var(--rf-foreground) 50%, transparent)"
                  : "color-mix(in srgb, var(--rf-foreground) 25%, transparent)",
            }}
            transition={spring.fast}
            style={{ left: handleLineLeftStyle, width: 2 }}
          />
        )}

        {/* Scrubber: label */}
        {variant === "scrubber" && label && (
          <motion.span
            className="z-10 shrink-0 text-[13px]"
            initial={false}
            animate={{
              color: isActive ? "var(--rf-foreground)" : "var(--rf-muted-foreground)",
            }}
            transition={spring.fast}
          >
            {label}
          </motion.span>
        )}

        {/* Scrubber: flex-1 spacer + value */}
        {variant === "scrubber" && (
          <>
            <div className="flex-1" />
            <motion.span
              className="z-10 shrink-0 text-right text-[13px] tabular-nums"
              initial={false}
              animate={{
                color: isActive ? "var(--rf-foreground)" : "var(--rf-muted-foreground)",
              }}
              transition={spring.fast}
              style={{ minWidth: `${formatValue(max).length}ch` }}
            >
              {formatValue(value)}
            </motion.span>
          </>
        )}

        {/* Resize handle (scrubber only) */}
        {variant === "scrubber" && (
          <motion.div
            className="absolute top-0 bottom-0 z-20 w-2 cursor-ew-resize"
            style={{ left: handleLeftStyle }}
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerUp}
          />
        )}
      </motion.div>
    </div>
  )
}

export { Slider, SliderComfortable }
export type { SliderComfortableProps, SliderProps, SliderValue, ValuePosition }
