export class SubtitlesError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = "SubtitlesError"
    this.code = code
  }
}

export class ToastSubtitlesError extends SubtitlesError {
  constructor(code: string) {
    super(code)
    this.name = "ToastSubtitlesError"
  }
}

export class OverlaySubtitlesError extends SubtitlesError {
  constructor(code: string) {
    super(code)
    this.name = "OverlaySubtitlesError"
  }
}
