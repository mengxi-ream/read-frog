import type { ErrorAction } from "@/utils/error-action"

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
