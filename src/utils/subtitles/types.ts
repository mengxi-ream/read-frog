export type SubtitlesState = "idle" | "loading" | "error"

export interface StateData {
  state: SubtitlesState
  message?: string
  /**
   * An error that stays until the next state instead of hiding after a few
   * seconds: translation is held, or the line on screen failed, and the reason
   * must not disappear while it is. The coordinator takes it down itself.
   */
  persistent?: boolean
  /** A failed Built-in AI call's id, for the user to quote in a report. */
  requestId?: string
}

export interface SubtitlesFragment {
  text: string
  start: number
  end: number
  translation?: string
  /**
   * Set when `translation` stands in for the subtitles provider's own: a
   * machine translation shown until the AI one arrives. Unset, it is the
   * provider's own.
   */
  placeholder?: "machine"
}
