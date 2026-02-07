export type SubtitlesState
  = | 'idle'
    | 'fetching'
    | 'fetchSuccess'
    | 'fetchFailed'
    | 'segmenting'
    | 'processing'
    | 'error'

export interface StateData {
  state: SubtitlesState
  message?: string
}

export interface SubtitlesFragment {
  text: string
  start: number
  end: number
  translation?: string
}
