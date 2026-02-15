import type { StateData, SubtitlesFragment } from './types'
import type { SubtitlesDisplayMode } from '@/types/config/subtitles'

export interface SubtitleDisplayDecision {
  hasRenderableSubtitle: boolean
  showStateMessage: boolean
}

export function hasRenderableSubtitleByMode(
  subtitle: SubtitlesFragment | null,
  displayMode: SubtitlesDisplayMode,
): boolean {
  if (!subtitle)
    return false

  if (displayMode === 'translationOnly')
    return !!subtitle.translation

  return true
}

export function deriveSubtitleDisplayDecision(
  stateData: StateData | null,
  subtitle: SubtitlesFragment | null,
  displayMode: SubtitlesDisplayMode,
): SubtitleDisplayDecision {
  const hasRenderable = hasRenderableSubtitleByMode(subtitle, displayMode)
  const state = stateData?.state ?? 'idle'

  if (state === 'error') {
    return { hasRenderableSubtitle: hasRenderable, showStateMessage: true }
  }

  if (state === 'loading') {
    return { hasRenderableSubtitle: hasRenderable, showStateMessage: !hasRenderable }
  }

  return { hasRenderableSubtitle: hasRenderable, showStateMessage: false }
}
