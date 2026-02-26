import type { SubtitlesState } from "@/utils/subtitles/types"
import { i18n } from "#imports"
import { STATE_MESSAGE_CLASS } from "@/utils/constants/subtitles"

const STATE_CONFIG: Record<Exclude<SubtitlesState, "idle">, { color: string, getText: () => string }> = {
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
  if (!state)
    return null

  const { color, getText } = STATE_CONFIG[state]

  const text = state === "error" ? message : getText()

  return (
    <div
      className={`${STATE_MESSAGE_CLASS} absolute left-1/2 -translate-x-1/2 bottom-1/6 pointer-events-auto`}
      style={{
        fontFamily: "Roboto, \"Arial Unicode Ms\", Arial, Helvetica, Verdana, \"PT Sans Caption\", sans-serif",
      }}
    >
      <div
        className="flex items-center justify-center px-3 py-2 rounded-md text-base font-medium whitespace-nowrap leading-tight backdrop-blur-sm bg-black/85 shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
        style={{ color }}
      >
        {text}
      </div>
    </div>
  )
}
