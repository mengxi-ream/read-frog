import type { ErrorAction } from "@/utils/error-action"
import { i18n } from "@/utils/i18n"

export class SubtitlesError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = "SubtitlesError"
    this.code = code
  }
}

export class ToastSubtitlesError extends SubtitlesError {
  readonly action?: ErrorAction

  constructor(code: string, action?: ErrorAction) {
    super(code)
    this.name = "ToastSubtitlesError"
    this.action = action
  }
}

export class OverlaySubtitlesError extends SubtitlesError {
  constructor(code: string) {
    super(code)
    this.name = "OverlaySubtitlesError"
  }
}

/** The video has no captions to load — a fact about the video, not a failure of ours. */
export class NoSubtitlesError extends OverlaySubtitlesError {
  constructor() {
    super(i18n.t("subtitles.errors.noSubtitlesFound"))
  }
}
