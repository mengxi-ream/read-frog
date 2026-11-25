import type { SubtitlesState } from "@/utils/subtitles/types"
import { CopyBuiltInAiRequestIdButton } from "@/components/built-in-ai-request-id"
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
  requestId?: string
}

export function StateMessage({ state, message, requestId }: StateMessageProps) {
  if (!state) return null

  const { color, getText } = STATE_CONFIG[state]

  const text = state === "error" ? message : (message ?? getText())

  if (!text) return null

  return (
    // One line that ends at the player's right edge, as far from it as from the left: a
    // provider's error can be longer than the player is wide. The whole text is the tooltip,
    // and a failed Built-in AI call's id too, beside a button that copies it.
    <div
      className={`${STATE_MESSAGE_CLASS} pointer-events-auto absolute bottom-18 left-4 max-w-[calc(100%-2rem)]`}
      style={{
        fontFamily:
          'Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif',
      }}
    >
      <div
        className="flex items-center justify-center rounded-md bg-black/50 px-3 py-2 text-base leading-tight font-medium whitespace-nowrap shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-sm"
        style={{ color }}
        title={requestId ? `${text}\n${i18n.t("hostedAi.requestId.label")} ${requestId}` : text}
      >
        {/* AI subtitles can take minutes; a static label reads as stuck. The box is
            always dark over the video, so the sweep brightens toward white. */}
        <span className={state === "loading" ? "shimmer truncate shimmer-color-white" : "truncate"}>
          {text}
        </span>
        {requestId && (
          <CopyBuiltInAiRequestIdButton
            requestId={requestId}
            className="-my-1 -mr-1.5 ml-1.5 shrink-0 text-white/70 hover:bg-white/15 hover:text-white dark:hover:bg-white/15"
          />
        )}
      </div>
    </div>
  )
}
