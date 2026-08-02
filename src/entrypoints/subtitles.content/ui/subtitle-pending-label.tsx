import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

const DOT_COUNT = 3
const STAGGER_MS = 180

function stripTrailingEllipsis(label: string): string {
  return label.replace(/[\s.…⋯]+$/u, "").trimEnd()
}

/**
 * Restrained pending indicator for bilingual subtitles (CSS-driven appear + breath).
 */
export function SubtitlePendingLabel({ className }: { className?: string }) {
  const text = stripTrailingEllipsis(i18n.t("subtitles.state.translating"))

  return (
    <span
      className={cn(
        "inline-flex animate-subtitle-pending-appear items-center justify-center gap-[0.28em] leading-none font-normal tracking-wide",
        className,
      )}
      data-subtitle-pending-indicator=""
      aria-hidden
    >
      <span className="text-[0.74em] leading-none opacity-70">{text}</span>
      <span className="inline-flex items-center gap-[0.18em]" data-subtitle-pending-dots="">
        {Array.from({ length: DOT_COUNT }, (_, index) => (
          <span
            key={index}
            className="inline-block size-[0.16em] max-h-[5px] min-h-[3px] max-w-[5px] min-w-[3px] animate-subtitle-pending-breath rounded-full bg-current will-change-[opacity]"
            style={{ animationDelay: `${index * STAGGER_MS}ms` }}
          />
        ))}
      </span>
    </span>
  )
}
