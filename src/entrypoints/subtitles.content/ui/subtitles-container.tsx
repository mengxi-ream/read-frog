import type { ControlsConfig } from '@/entrypoints/subtitles.content/platforms'
import { useAtomValue } from 'jotai'
import { Activity } from 'react'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { deriveSubtitleDisplayDecision } from '@/utils/subtitles/display-rules'
import { subtitlesDisplayAtom } from '../atoms'
import { StateMessage } from './state-message'
import { SubtitlesView } from './subtitles-view'

interface SubtitlesContainerProps {
  controlsConfig?: ControlsConfig
}

export function SubtitlesContainer({ controlsConfig }: SubtitlesContainerProps) {
  const { stateData, subtitle, isVisible } = useAtomValue(subtitlesDisplayAtom)
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)

  if (!isVisible) {
    return null
  }

  const { hasRenderableSubtitle, showStateMessage } = deriveSubtitleDisplayDecision(
    stateData,
    subtitle,
    style.displayMode,
  )

  return (
    <>
      <SubtitlesView controlsConfig={controlsConfig} isRenderable={hasRenderableSubtitle} />
      <Activity mode={showStateMessage ? 'visible' : 'hidden'}>
        <StateMessage />
      </Activity>
    </>
  )
}
