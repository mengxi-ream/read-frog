/**
 * A call to action carried alongside a toast error — "Upgrade", "Log in".
 * Described as data rather than a callback so the layer that raises the error
 * stays free of UI concerns and the tests can assert on it without comparing
 * functions; the content script's toast host turns it into a button.
 */
export interface SubtitlesErrorAction {
  /** Already localized. */
  label: string
  /** Absolute URL, opened through the background worker on click. */
  url: string
}

export class SubtitlesError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = "SubtitlesError"
    this.code = code
  }
}

export class ToastSubtitlesError extends SubtitlesError {
  readonly action?: SubtitlesErrorAction

  constructor(code: string, action?: SubtitlesErrorAction) {
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
