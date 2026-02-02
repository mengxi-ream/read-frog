import type { SubtitlesFragment } from '@/utils/subtitles/types'

export interface SubtitlesFetcher {
  fetch: () => Promise<SubtitlesFragment[]>
  cleanup: () => void
}
