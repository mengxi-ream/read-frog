"use client"

import type { AnimationPlaybackControls, Transition } from "motion/react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { animate, motion, useMotionValue } from "motion/react"
import * as React from "react"
import { spring } from "@/utils/styles/springs"
import { cn } from "@/utils/styles/utils"

type SwitchSize = "sm" | "default"

/* Base UI renders the root as a `<span role="switch">` and hands its handlers a
   BaseUIEvent, so borrow the exact parameter type rather than guessing at it. */
type SwitchPointerEvent = Parameters<NonNullable<SwitchPrimitive.Root.Props["onPointerDown"]>>[0]

type SwitchProps = Omit<SwitchPrimitive.Root.Props, "onCheckedChange"> & {
  size?: SwitchSize
  /**
   * Callback fired when the checked state changes.
   * API compatible with old Radix-based shadcn Switch.
   */
  onCheckedChange?: (checked: boolean) => void
  /** Overrides the spring the thumb travels on. */
  thumbTransition?: Transition
}

/* `track`/`height` are the outer pill, `thumb` the resting circle, `gap` the inset
   around it. `height === thumb + 2 * gap` has to hold or the thumb stops being
   round. A thumb that floats inside the track reads as friendlier than one that
   fills it edge to edge, so the gap is ~10% of the track height. */
const SIZES = {
  default: { track: 32, height: 18.4, thumb: 14.4, gap: 2 },
  sm: { track: 24, height: 14, thumb: 11, gap: 1.5 },
} as const satisfies Record<
  SwitchSize,
  { track: number; height: number; thumb: number; gap: number }
>

/** Pointer slop, in px, before a press is reinterpreted as a drag. */
const DRAG_DEAD_ZONE = 2

/* The track carries a 1px transparent border that focus-visible and aria-invalid
   colour in. An absolutely positioned child is laid out against the padding box,
   i.e. inside that border, so every thumb coordinate below is padding-box relative
   and has to give the border back. Miss this and the thumb sits 3px from the left
   edge but 1px from the right. */
const TRACK_BORDER = 1

/* The thumb is driven by a motion value rather than a CSS transition because the
   pointer can grab it mid-flight: a drag has to pick up wherever the spring
   currently is, and the release has to spring on from there without a velocity
   reset. Width/height/y ride the same spring declaratively.

   It reshapes under the pointer — a pill on hover (thumb/8 wider), a squash on
   press (thumb/4 wider, thumb/4 shorter). Growing it would push past the track on
   the checked side, so the extra width is subtracted back out of the resting x,
   which pins the right edge while the thumb stretches inward. */
function Switch({
  className,
  size = "default",
  checked,
  defaultChecked,
  disabled = false,
  onCheckedChange,
  thumbTransition,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerEnter,
  onPointerLeave,
  ...props
}: SwitchProps) {
  const { track, height, thumb, gap } = SIZES[size]
  const inset = gap - TRACK_BORDER
  const travel = track - 2 * gap - thumb
  const pillExtend = thumb / 8
  const pressExtend = thumb / 4

  const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked ?? false)
  const isChecked = checked ?? uncontrolledChecked

  const [hovered, setHovered] = React.useState(false)
  const [pressed, setPressed] = React.useState(false)

  const hasMounted = React.useRef(false)
  const dragging = React.useRef(false)
  /* Set on the pointerup that ends a drag and cleared a frame later, so the click
     Base UI synthesises from that same pointerup does not toggle a second time. */
  const didDrag = React.useRef(false)
  const pointerStart = React.useRef<{ clientX: number; originX: number } | null>(null)
  const travelAnimation = React.useRef<AnimationPlaybackControls | null>(null)

  const x = useMotionValue(isChecked ? inset + travel : inset)
  const transition = thumbTransition ?? spring.moderate

  const thumbWidth = pressed ? thumb + pressExtend : hovered ? thumb + pillExtend : thumb
  const thumbHeight = pressed ? thumb - pressExtend : thumb
  const thumbY = pressed ? inset + pressExtend / 2 : inset
  const restingX = isChecked ? inset + travel - (thumbWidth - thumb) : inset

  /* Drag bounds assume the pressed (widest) thumb, since a drag is always pressed. */
  const dragMin = inset
  const dragMax = inset + travel - pressExtend

  React.useEffect(() => {
    hasMounted.current = true
  }, [])

  React.useEffect(() => {
    if (dragging.current) return undefined
    if (!hasMounted.current) {
      x.set(restingX)
      return undefined
    }
    const controls = animate(x, restingX, transition)
    travelAnimation.current = controls
    return () => controls.stop()
  }, [restingX, x, transition])

  const commitChecked = React.useCallback(
    (next: boolean) => {
      setUncontrolledChecked(next)
      onCheckedChange?.(next)
    },
    [onCheckedChange],
  )

  const handleCheckedChange = React.useCallback(
    (next: boolean, _eventDetails: unknown) => {
      if (didDrag.current) return
      commitChecked(next)
    },
    [commitChecked],
  )

  const handlePointerDown = React.useCallback(
    (event: SwitchPointerEvent) => {
      onPointerDown?.(event)
      if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return
      setPressed(true)
      dragging.current = false
      didDrag.current = false
      pointerStart.current = { clientX: event.clientX, originX: x.get() }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [disabled, onPointerDown, x],
  )

  const handlePointerMove = React.useCallback(
    (event: SwitchPointerEvent) => {
      onPointerMove?.(event)
      if (!pointerStart.current) return
      const delta = event.clientX - pointerStart.current.clientX
      if (!dragging.current) {
        if (Math.abs(delta) < DRAG_DEAD_ZONE) return
        dragging.current = true
        /* Pressing reshaped the thumb, so a spring toward the pressed resting
           position is still in flight and would keep overwriting the value we set
           below. The finger wins: stop it, then re-anchor on wherever the thumb
           actually is, so tracking starts from the current pixel instead of
           snapping by the dead zone plus whatever the spring had already moved. */
        travelAnimation.current?.stop()
        pointerStart.current = { clientX: event.clientX, originX: x.get() }
        return
      }
      x.set(Math.max(dragMin, Math.min(dragMax, pointerStart.current.originX + delta)))
    },
    [dragMax, dragMin, onPointerMove, x],
  )

  const handlePointerUp = React.useCallback(
    (event: SwitchPointerEvent) => {
      onPointerUp?.(event)
      if (!pointerStart.current) return
      pointerStart.current = null
      setPressed(false)
      if (!dragging.current) return

      dragging.current = false
      didDrag.current = true

      const shouldBeOn = x.get() > (dragMin + dragMax) / 2
      if (shouldBeOn !== isChecked) commitChecked(shouldBeOn)
      else animate(x, isChecked ? inset + travel : inset, transition)

      requestAnimationFrame(() => {
        didDrag.current = false
      })
    },
    [commitChecked, dragMax, dragMin, inset, isChecked, onPointerUp, transition, travel, x],
  )

  const handlePointerCancel = React.useCallback(
    (event: SwitchPointerEvent) => {
      onPointerCancel?.(event)
      if (!pointerStart.current) return
      pointerStart.current = null
      setPressed(false)
      if (!dragging.current) return
      dragging.current = false
      animate(x, isChecked ? inset + travel : inset, transition)
    },
    [inset, isChecked, onPointerCancel, transition, travel, x],
  )

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 cursor-pointer touch-none items-center rounded-full border border-transparent shadow-xs transition-colors duration-100 outline-none select-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-control-on focus-visible:ring-[3px] focus-visible:ring-control-on/50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 dark:focus-visible:ring-control-on/60 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-control-on data-checked:hover:not-data-disabled:bg-control-on-hover data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      checked={checked}
      defaultChecked={defaultChecked}
      disabled={disabled}
      onCheckedChange={handleCheckedChange}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerEnter={(event) => {
        onPointerEnter?.(event)
        if (event.pointerType === "mouse" && !disabled) setHovered(true)
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event)
        setHovered(false)
      }}
      {...props}
      style={{ width: track, height }}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        render={(thumbProps) => {
          /* motion.span and React disagree on the drag/animation handler types that
             Base UI forwards, and none of them are used here. */
          const {
            style: baseStyle,
            onDrag: _onDrag,
            onDragStart: _onDragStart,
            onDragEnd: _onDragEnd,
            onAnimationStart: _onAnimationStart,
            onAnimationEnd: _onAnimationEnd,
            onAnimationIteration: _onAnimationIteration,
            ...rest
          } = thumbProps as React.HTMLAttributes<HTMLSpanElement>
          return (
            <motion.span
              {...rest}
              className="pointer-events-none absolute top-0 left-0 block rounded-full bg-white"
              initial={false}
              style={{ ...baseStyle, x }}
              animate={{ y: thumbY, width: thumbWidth, height: thumbHeight }}
              transition={hasMounted.current ? transition : { duration: 0 }}
            />
          )
        }}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
