import type { BuiltInAiPromptTrigger } from "@/types/analytics"
import { toastManager } from "@/components/ui/base-ui/toast"
import { ANALYTICS_FEATURE } from "@/types/analytics"
import { promptForBuiltInAiRefusal } from "@/utils/content-runtime/built-in-ai-prompt"
import { getBuiltInAiRefusalKind } from "@/utils/hosted-ai/refusal"
import { createLogger } from "@/utils/logging/logger"

const log = createLogger("subtitles/built-in-ai-refusal")

/**
 * The refusals already asked about in this document, one per video (by `getVideoId` or
 * the page's URL) and kind: a guest who logs in from the prompt can be refused again
 * on the same video, now for a spent pool, and is then asked to upgrade.
 */
const promptedVideos = new Set<string>()

const ULTRA_REFUSAL_TOAST_ID = "subtitles-built-in-ai-refusal"

/**
 * The dialog, or in a frame without one the toast, is drawn on the page, which a
 * fullscreen player covers: leave fullscreen first, or the reader is asked a question
 * they can't see.
 */
async function leaveFullscreen(): Promise<void> {
  if (!document.fullscreenElement) {
    return
  }
  try {
    await document.exitFullscreen()
  } catch (error) {
    log.warn("Could not leave fullscreen for the Built-in AI prompt", { error })
  }
}

/**
 * Asks someone whose subtitle lines Built-in AI refused to log in or upgrade, or to switch
 * subtitles to machine translation, once a video for each: every cue batch after the
 * first would ask again, but a guest who logs in and finds the pool spent is still asked
 * to upgrade. Only line translation asks; a refused summary or AI segmentation keeps
 * quiet, as the lines still come. Ultra, with no plan to upgrade to, gets its plain
 * message instead, once a video too. Returns whether the error was such a refusal.
 */
export function promptForSubtitlesRefusal(
  error: unknown,
  options: { videoKey: string; trigger: BuiltInAiPromptTrigger; retry: () => void },
): boolean {
  const kind = getBuiltInAiRefusalKind(error)
  if (!kind) {
    return false
  }
  const promptKey = `${options.videoKey}\0${kind}`
  if (promptedVideos.has(promptKey)) {
    return true
  }
  promptedVideos.add(promptKey)
  void promptForBuiltInAiRefusal(error, {
    feature: "videoSubtitles",
    analyticsFeature: ANALYTICS_FEATURE.VIDEO_SUBTITLES,
    trigger: options.trigger,
    retry: options.retry,
    beforePrompt: leaveFullscreen,
  }).then((prompted) => {
    // Translation holds either way: without this, Ultra would see nothing say why.
    if (!prompted) {
      toastManager.add({
        id: ULTRA_REFUSAL_TOAST_ID,
        type: "error",
        title: error instanceof Error ? error.message : String(error),
      })
    }
  })
  return true
}

/** Tests only. */
export function resetPromptedSubtitlesVideos(): void {
  promptedVideos.clear()
}
