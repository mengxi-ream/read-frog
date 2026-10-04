"use client"

import type { Transition } from "motion/react"
import { mergeProps } from "@base-ui/react/merge-props"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { animate, motion, useMotionValue } from "motion/react"
import * as React from "react"
import { cn } from "@/utils/styles/utils"

// Ported from the design system (`@repo/ui`'s switch.tsx); keep the two in step.

type SwitchSize = "sm" | "default"

type SwitchProps = SwitchPrimitive.Root.Props & { size?: SwitchSize }

/* `track`/`height` are the outer pill, `thumb` the resting circle, `gap` the inset
   around it. `height === thumb + 2 * gap` has to hold or the thumb stops being
   round. A thumb that floats inside the track reads as friendlier than one that
   fills it edge to edge, so the gap is ~10% of the track height. These are
   numbers rather than classes because the thumb's spring and the drag bounds
   are computed from them. */
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
   i.e. inside that border, so every thumb x below is padding-box relative and has
   to give the border back. Miss this and the thumb sits 3px from the left edge but
   1px from the right. */
const TRACK_BORDER = 1

/* Critically damped: lands exactly, with no overshoot, which suits a trip this short. */
const THUMB_SPRING = { type: "spring", duration: 0.16, bounce: 0 } as const satisfies Transition

/* The thumb is driven by a motion value rather than a CSS transition because the
   pointer can grab it mid-flight: a drag has to pick up wherever the spring
   currently is, and the release has to spring on from there without a velocity
   reset. Width and height ride the same spring declaratively.

   It reshapes under the pointer — a pill on hover (thumb/8 wider), a squash on
   press (thumb/4 wider, thumb/4 shorter). Growing it would push past the track on
   the checked side, so the extra width is subtracted back out of the resting x,
   which pins the right edge while the thumb stretches inward. */
function Switch({
  className,
  style,
  size = "default",
  checked,
  defaultChecked,
  disabled = false,
  readOnly = false,
  inputRef,
  onCheckedChange,
  ...props
}: SwitchProps) {
  const { track, height, thumb, gap } = SIZES[size]
  const inset = gap - TRACK_BORDER
  const travel = track - 2 * gap - thumb
  const pressExtend = thumb / 4
  /* Base UI already refuses to toggle a read-only switch on click or key; the
     drag and the hover/press shapes have to refuse too. */
  const locked = disabled || readOnly

  /* Base UI is always driven as controlled, from `isChecked`, so there is one copy
     of the state; the thumb's position is derived from it here. */
  const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked ?? false)
  const isChecked = checked ?? uncontrolledChecked

  /* Base UI's hidden checkbox. A drag toggles by clicking it, the same path a
     click on the switch takes, so every toggle arrives with real event details. */
  const inputElement = React.useRef<HTMLInputElement>(null)
  /* The caller's own `inputRef` still gets the element, handed on from ours. */
  React.useImperativeHandle(inputRef, () => inputElement.current as HTMLInputElement, [])

  const [hovered, setHovered] = React.useState(false)
  const [pressed, setPressed] = React.useState(false)

  /* The press in progress: where it started, and whether it has become a drag. */
  const gesture = React.useRef<{ clientX: number; originX: number; dragging: boolean } | null>(null)
  /* A drag ends in a pointerup, and the browser follows that with a click on the
     switch; this swallows it so the drag's own toggle is the only one. */
  const swallowNextClick = React.useRef(false)

  const extend = pressed ? pressExtend : hovered ? thumb / 8 : 0
  const thumbWidth = thumb + extend
  const thumbHeight = pressed ? thumb - pressExtend : thumb
  const restingX = isChecked ? inset + travel - extend : inset

  /* Starting at `restingX` is what keeps the first paint still: on mount the
     effect below springs the thumb to where it already is. */
  const x = useMotionValue(restingX)

  /* The drag's right bound assumes the pressed (widest) thumb, since a drag is
     always pressed; its left bound is `inset`. */
  const dragMax = inset + travel - pressExtend

  React.useEffect(() => {
    if (gesture.current?.dragging) return undefined
    const controls = animate(x, restingX, THUMB_SPRING)
    return () => controls.stop()
  }, [restingX, x])

  /* Ends a press and reports whether it was a drag. A drag's thumb springs back to
     the resting position; the render that follows re-targets it if releasing
     moved that position (the thumb un-squashes, or the switch toggles). */
  function release(): boolean {
    const wasDragging = gesture.current?.dragging ?? false
    gesture.current = null
    setPressed(false)
    if (wasDragging) animate(x, restingX, THUMB_SPRING)
    return wasDragging
  }

  /* Merged ahead of the caller's props, so the caller's handlers run first and can
     call `event.preventBaseUIHandler()` to skip these, as with any Base UI part. */
  /* oxlint-disable react/refs -- mergeProps only stores these handlers; they read refs when events fire, not during render. */
  const gestureProps = mergeProps<typeof SwitchPrimitive.Root>(
    {
      onPointerDown(event) {
        if (locked || (event.pointerType === "mouse" && event.button !== 0)) return
        setPressed(true)
        swallowNextClick.current = false
        gesture.current = { clientX: event.clientX, originX: x.get(), dragging: false }
        event.currentTarget.setPointerCapture(event.pointerId)
      },
      onPointerMove(event) {
        const current = gesture.current
        if (!current) return
        const delta = event.clientX - current.clientX
        if (!current.dragging) {
          if (Math.abs(delta) < DRAG_DEAD_ZONE) return
          /* Pressing reshaped the thumb, so a spring toward the pressed resting
             position is still in flight and would keep overwriting the value set
             below. The finger wins: stop it, then re-anchor on wherever the thumb
             actually is, so tracking starts from the current pixel instead of
             snapping by the dead zone plus whatever the spring had already moved. */
          x.stop()
          gesture.current = { clientX: event.clientX, originX: x.get(), dragging: true }
          return
        }
        x.set(Math.max(inset, Math.min(dragMax, current.originX + delta)))
      },
      onPointerUp() {
        if (!gesture.current) return
        const shouldBeOn = x.get() > (inset + dragMax) / 2
        if (!release()) return
        if (shouldBeOn !== isChecked) inputElement.current?.click()
        swallowNextClick.current = true
      },
      onPointerCancel() {
        if (gesture.current) release()
      },
      onPointerEnter(event) {
        if (event.pointerType === "mouse" && !locked) setHovered(true)
      },
      onPointerLeave() {
        setHovered(false)
      },
      onClick(event) {
        /* Keyboard toggles arrive as clicks with `detail` 0 and are never swallowed. */
        if (!swallowNextClick.current || event.detail === 0) return
        swallowNextClick.current = false
        event.preventBaseUIHandler()
      },
    },
    props,
  )
  /* oxlint-enable react/refs */

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 cursor-pointer touch-none items-center rounded-full border border-transparent transition-colors duration-100 outline-none select-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-readonly:cursor-default dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-accent data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...gestureProps}
      checked={isChecked}
      inputRef={inputElement}
      disabled={disabled}
      readOnly={readOnly}
      onCheckedChange={(next, eventDetails) => {
        onCheckedChange?.(next, eventDetails)
        if (!eventDetails.isCanceled) setUncontrolledChecked(next)
      }}
      /* The thumb geometry is computed from these two, so they are applied after
         the caller's style rather than being overridable by it. */
      style={(state) => ({
        ...(typeof style === "function" ? style(state) : style),
        width: track,
        height,
      })}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        render={
          <motion.span
            className="pointer-events-none absolute top-1/2 left-0 block rounded-full bg-white"
            initial={false}
            style={{ x, y: "-50%" }}
            animate={{ width: thumbWidth, height: thumbHeight }}
            transition={THUMB_SPRING}
          />
        }
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
