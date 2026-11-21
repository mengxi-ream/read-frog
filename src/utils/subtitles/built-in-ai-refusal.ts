import type { BuiltInAiPromptTrigger } from "@/types/analytics"
import { ANALYTICS_FEATURE } from "@/types/analytics"
import { promptForBuiltInAiRefusal } from "@/utils/content-runtime/built-in-ai-prompt"
import { getBuiltInAiRefusalKind } from "@/utils/hosted-ai/refusal"
import { createLogger } from "@/utils/logging/logger"

const log = createLogger("subtitles/built-in-ai-refusal")

/** The videos already asked about in this document, by `getVideoId` or the page's URL. */
const promptedVideos = new Set<string>()

/**
 * The dialog is drawn on the page, which a fullscreen player covers: leave fullscreen
 * first, or the reader is asked a question they can't see.
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
 * subtitles to machine translation, at most once a video: every cue batch after the first
 * would ask again. Only line translation asks; a refused summary or AI segmentation keeps
 * quiet, as the lines still come. Returns whether the error was such a refusal.
 */
export function promptForSubtitlesRefusal(
  error: unknown,
  options: { videoKey: string; trigger: BuiltInAiPromptTrigger; retry: () => void },
): boolean {
  if (!getBuiltInAiRefusalKind(error)) {
    return false
  }
  if (promptedVideos.has(options.videoKey)) {
    return true
  }
  promptedVideos.add(options.videoKey)
  void promptForBuiltInAiRefusal(error, {
    feature: "videoSubtitles",
    analyticsFeature: ANALYTICS_FEATURE.VIDEO_SUBTITLES,
    trigger: options.trigger,
    retry: options.retry,
    beforeDialog: leaveFullscreen,
  })
  return true
}

/** Tests only. */
export function resetPromptedSubtitlesVideos(): void {
  promptedVideos.clear()
}
