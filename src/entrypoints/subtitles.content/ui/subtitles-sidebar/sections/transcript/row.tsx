import type { Ref } from "react"
import type { TranscriptLine } from "@/utils/subtitles/transcript"
import { cn } from "@/utils/styles/utils"
import { formatTimestamp } from "@/utils/subtitles/transcript"

interface TranscriptRowProps {
  line: TranscriptLine
  isActive: boolean
  onSeek: (seconds: number) => void
  activeRowRef?: Ref<HTMLButtonElement>
}

export function TranscriptRow({ line, isActive, onSeek, activeRowRef }: TranscriptRowProps) {
  return (
    <button
      ref={activeRowRef}
      type="button"
      aria-current={isActive || undefined}
      onClick={() => onSeek(line.start / 1000)}
      className={cn(
        "block w-full rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        isActive ? "bg-brand/20" : "hover:bg-muted/40",
      )}
    >
      <span className="block font-mono text-[12px] leading-5 text-foreground/65 tabular-nums">
        {formatTimestamp(line.start)}
      </span>
      <span
        className={cn(
          "mt-0.5 block text-[14px] leading-relaxed transition-colors",
          isActive ? "text-foreground" : "text-foreground/85",
        )}
      >
        {line.text}
      </span>
      {line.translation && (
        <span
          className={cn(
            "mt-1 block text-[14px] leading-relaxed transition-colors",
            isActive ? "text-foreground" : "text-foreground/70",
          )}
        >
          {line.translation}
        </span>
      )}
    </button>
  )
}
