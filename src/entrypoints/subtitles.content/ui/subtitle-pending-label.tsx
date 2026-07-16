import { cn } from "@/utils/styles/utils"

const DOT_COUNT = 3
/** Slow cycle keeps the motion peripheral during video watching. */
const BREATH_MS = 2000
const STAGGER_MS = 180

interface SubtitlePendingLabelProps {
  className?: string
  label: string
}

/** Drop trailing ellipsis so we do not render "翻译中……". */
function stripTrailingEllipsis(label: string): string {
  return label.replace(/[\s.…⋯]+$/u, "").trimEnd()
}

/**
 * Restrained pending indicator for bilingual subtitles:
 * slightly smaller status text + soft opacity-only breathing dots.
 * Dots are geometric circles flex-centered to the label's mid height.
 */
export function SubtitlePendingLabel({ className, label }: SubtitlePendingLabelProps) {
  const text = stripTrailingEllipsis(label)

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-[0.28em] leading-none font-normal tracking-wide",
        className,
      )}
      data-subtitle-pending-indicator=""
      aria-hidden
    >
      <style>{`
        @keyframes rf-subtitle-pending-breath {
          0%,
          100% {
            opacity: 0.22;
          }
          50% {
            opacity: 0.58;
          }
        }
      `}</style>
      <span className="text-[0.74em] leading-none opacity-70">{text}</span>
      <span className="inline-flex items-center gap-[0.18em]" data-subtitle-pending-dots="">
        {Array.from({ length: DOT_COUNT }, (_, index) => (
          <span
            key={index}
            className="inline-block size-[0.16em] max-h-[5px] min-h-[3px] max-w-[5px] min-w-[3px] rounded-full bg-current will-change-[opacity]"
            style={{
              animationName: "rf-subtitle-pending-breath",
              animationDuration: `${BREATH_MS}ms`,
              animationTimingFunction: "ease-in-out",
              animationIterationCount: "infinite",
              animationDelay: `${index * STAGGER_MS}ms`,
            }}
          />
        ))}
      </span>
    </span>
  )
}
