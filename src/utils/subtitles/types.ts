export type SubtitlesState = "idle" | "loading" | "error"

export interface StateData {
  state: SubtitlesState
  message?: string
  /**
   * An error that stays until the next state instead of hiding after a few
   * seconds: translation is held, and the reason must not disappear while it is.
   */
  persistent?: boolean
}

export interface SubtitlesFragment {
  text: string
  start: number
  end: number
  translation?: string
  /**
   * Set when `translation` stands in for the subtitles provider's own: a
   * machine translation shown until the AI one arrives, or what is left when
   * the provider failed the line. Unset, it is the provider's own.
   */
  placeholder?: "machine" | "failed"
}
