import type { SubtitlesState } from '@/utils/subtitles/types'
import { i18n } from '#imports'
import { useAtomValue } from 'jotai'
import { STATE_MESSAGE_CLASS } from '@/utils/constants/subtitles'
import { subtitlesStateAtom } from '../atoms'

const STATE_CONFIG: Record<Exclude<SubtitlesState, 'idle'>, { color: string, getText: () => string, position: string }> = {
  loading: {
    color: 'oklch(70% 0.19 250)',
    getText: () => i18n.t('subtitles.state.loading'),
    position: 'bottom-20',
  },
  error: {
    color: 'oklch(63% 0.24 25)',
    getText: () => i18n.t('subtitles.state.error'),
    position: 'top-1/2 -translate-y-1/2',
  },
}

export function StateMessage() {
  const stateData = useAtomValue(subtitlesStateAtom)

  if (!stateData || stateData.state === 'idle') {
    return null
  }

  const { color, getText, position } = STATE_CONFIG[stateData.state]
  const message = stateData.message || getText()

  return (
    <div
      className={`${STATE_MESSAGE_CLASS} absolute left-1/2 -translate-x-1/2 pointer-events-auto ${position}`}
      style={{
        fontFamily: 'Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif',
      }}
    >
      <div
        className="flex items-center justify-center px-3 py-2 rounded-md text-base font-medium whitespace-nowrap leading-tight backdrop-blur-sm bg-black/85 shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
        style={{ color }}
      >
        {message}
      </div>
    </div>
  )
}
