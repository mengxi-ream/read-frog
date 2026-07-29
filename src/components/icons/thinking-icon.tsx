import { domAnimation, LazyMotion, m, useReducedMotion } from "motion/react"
import { cn } from "@/utils/styles/utils"

/* The three shapes share an identical command structure (M + 4×C + Z, 26 numbers
   each), which is what lets motion interpolate the `d` string between them. Keep
   them in lockstep if you ever redraw one. */
const CIRCLE_CLOCKWISE =
  "M 12 8 C 14.21 8 16 9.79 16 12 C 16 14.21 14.21 16 12 16 C 9.79 16 8 14.21 8 12 C 8 9.79 9.79 8 12 8 Z"
const INFINITY_LOOP =
  "M 12 12 C 14 8.5 19 8.5 19 12 C 19 15.5 14 15.5 12 12 C 10 8.5 5 8.5 5 12 C 5 15.5 10 15.5 12 12 Z"
const CIRCLE_COUNTER_CLOCKWISE =
  "M 12 16 C 14.21 16 16 14.21 16 12 C 16 9.79 14.21 8 12 8 C 9.79 8 8 9.79 8 12 C 8 14.21 9.79 16 12 16 Z"

const MORPH_KEYFRAMES = [
  CIRCLE_CLOCKWISE,
  INFINITY_LOOP,
  CIRCLE_COUNTER_CLOCKWISE,
  INFINITY_LOOP,
  CIRCLE_CLOCKWISE,
]

interface ThinkingIconProps extends React.ComponentProps<"svg"> {
  animated?: boolean
}

export function ThinkingIcon({ animated = true, className, ...props }: ThinkingIconProps) {
  const prefersReducedMotion = useReducedMotion() ?? false
  const isMorphing = animated && !prefersReducedMotion

  return (
    <LazyMotion features={domAnimation}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("size-4", className)}
        {...props}
      >
        <m.path
          d={CIRCLE_CLOCKWISE}
          animate={isMorphing ? { d: MORPH_KEYFRAMES } : { d: CIRCLE_CLOCKWISE }}
          transition={
            isMorphing
              ? {
                  d: {
                    duration: 6,
                    ease: "easeInOut",
                    repeat: Number.POSITIVE_INFINITY,
                    times: [0, 0.25, 0.5, 0.75, 1],
                  },
                }
              : // Settling from wherever the loop happened to be is the whole point
                // of animating this at runtime instead of in CSS.
                { d: { duration: 0.4, ease: "easeInOut" } }
          }
        />
      </svg>
    </LazyMotion>
  )
}
