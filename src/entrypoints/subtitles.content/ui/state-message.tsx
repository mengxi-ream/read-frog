import type { SubtitlesState } from "@/utils/subtitles/types"
import { STATE_MESSAGE_CLASS } from "@/utils/constants/subtitles"
import { i18n } from "@/utils/i18n"

const STATE_CONFIG: Record<
  Exclude<SubtitlesState, "idle">,
  { color: string; getText: () => string }
> = {
  loading: {
    color: "oklch(70% 0.19 250)",
    getText: () => i18n.t("subtitles.state.loading"),
  },
  error: {
    color: "oklch(63% 0.24 25)",
    getText: () => i18n.t("subtitles.state.error"),
  },
}

interface StateMessageProps {
  state?: Exclude<SubtitlesState, "idle">
  message?: string
}

export function StateMessage({ state, message }: StateMessageProps) {
  if (!state) return null

  const { color, getText } = STATE_CONFIG[state]

  const text = state === "error" ? message : getText()

  if (!text) return null

  return (
    <div
      className={`${STATE_MESSAGE_CLASS} pointer-events-auto absolute bottom-18 left-4`}
      style={{
        fontFamily:
          'Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif',
      }}
    >
      <div
        className="flex items-center justify-center rounded-md bg-black/50 px-3 py-2 text-base leading-tight font-medium whitespace-nowrap shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-sm"
        style={{ color }}
      >
        {text}
      </div>
    </div>
  )
}
