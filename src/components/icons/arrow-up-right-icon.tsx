import type { Variants } from "motion/react"
import { m } from "motion/react"
import { cn } from "@/utils/styles/utils"

/* lucide-animated's arrow-up-right: the arrow dips toward its tail and springs
   back. It plays on the `animate` variant, so the parent decides the trigger
   (e.g. `whileHover="animate"` on the whole button), and needs a LazyMotion
   ancestor since it renders `m`. */
const ARROW_VARIANTS: Variants = {
  normal: {
    scale: 1,
    translateX: 0,
    translateY: 0,
  },
  animate: {
    scale: [1, 0.85, 1],
    translateX: [0, -4, 0],
    translateY: [0, 4, 0],
    originX: 1,
    originY: 0,
    transition: {
      duration: 0.5,
      ease: "easeInOut",
    },
  },
}

export function ArrowUpRightIcon({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-4", className)}
      {...props}
    >
      <m.g variants={ARROW_VARIANTS}>
        <path d="M7 7H17" />
        <path d="M17 7V17" />
        <path d="M7 17L17 7" />
      </m.g>
    </svg>
  )
}
