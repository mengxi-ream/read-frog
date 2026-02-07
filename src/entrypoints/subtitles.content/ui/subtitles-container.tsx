import type { ControlsConfig } from '@/entrypoints/subtitles.content/platforms'
import { useAtomValue } from 'jotai'
import { Activity } from 'react'
import { subtitlesDisplayAtom } from '../atoms'
import { StateMessage } from './state-message'
import { SubtitlesView } from './subtitles-view'

interface SubtitlesContainerProps {
  controlsConfig?: ControlsConfig
}

export function SubtitlesContainer({ controlsConfig }: SubtitlesContainerProps) {
  const { stateData, isVisible } = useAtomValue(subtitlesDisplayAtom)

  if (!isVisible) {
    return null
  }

  const showStateMessage = stateData && stateData.state !== 'idle'

  return (
    <>
      <SubtitlesView controlsConfig={controlsConfig} />
      <Activity mode={showStateMessage ? 'visible' : 'hidden'}>
        <StateMessage />
      </Activity>
    </>
  )
}
