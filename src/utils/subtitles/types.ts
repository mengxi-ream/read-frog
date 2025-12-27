export type SubtitlesState
  = | 'idle'
    | 'fetching'
    | 'fetchSuccess'
    | 'fetchFailed'
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

// Batch translation types
export type BatchState = 'idle' | 'processing' | 'completed' | 'error'

export interface TranslationBatch {
  id: number
  startMs: number
  endMs: number
  state: BatchState
  fragments: SubtitlesFragment[]
}
