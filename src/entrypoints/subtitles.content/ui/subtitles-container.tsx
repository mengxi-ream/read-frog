import { useAtomValue } from 'jotai'
import { currentBlockCompletedAtom, subtitlesDisplayAtom } from '../atoms'
import { StateMessage } from './state-message'
import { SubtitlesView } from './subtitles-view'

export function SubtitlesContainer() {
  const { stateData, isVisible } = useAtomValue(subtitlesDisplayAtom)
  const currentBlockCompleted = useAtomValue(currentBlockCompletedAtom)

  if (!isVisible) {
    return null
  }

  if (currentBlockCompleted) {
    return <SubtitlesView />
  }

  if (stateData && stateData.state !== 'idle') {
    return <StateMessage />
  }

  return null
}
