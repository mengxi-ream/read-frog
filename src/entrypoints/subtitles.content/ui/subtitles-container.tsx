import { useAtomValue } from 'jotai'
import { Activity } from 'react'
import { currentBlockCompletedAtom, subtitlesDisplayAtom } from '../atoms'
import { StateMessage } from './state-message'
import { SubtitlesView } from './subtitles-view'

export function SubtitlesContainer() {
  const { stateData, isVisible } = useAtomValue(subtitlesDisplayAtom)
  const currentBlockCompleted = useAtomValue(currentBlockCompletedAtom)

  if (!isVisible) {
    return null
  }

  const showStateMessage = !currentBlockCompleted && stateData && stateData.state !== 'idle'

  return (
    <>
      <SubtitlesView />
      <Activity mode={showStateMessage ? 'visible' : 'hidden'}>
        <StateMessage />
      </Activity>
    </>
  )
}
