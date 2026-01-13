import { Icon } from '@iconify/react'
import { useAtomValue } from 'jotai'
import { Activity } from 'react'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { SUBTITLES_VIEW_CLASS } from '@/utils/constants/subtitles'
import { currentSubtitleAtom } from '../atoms'
import { MainSubtitle, TranslationSubtitle } from './subtitle-lines'
import { useVerticalDrag } from './use-vertical-drag'

function SubtitlesContent() {
  const subtitle = useAtomValue(currentSubtitleAtom)
  const { style: { displayMode, translationPosition } } = useAtomValue(configFieldsAtomMap.videoSubtitles)

  if (!subtitle)
    return null

  const translationAbove = translationPosition === 'above'
  const showMain = displayMode !== 'translationOnly'
  const showTranslation = displayMode !== 'originalOnly'

  return (
    <div className={`${SUBTITLES_VIEW_CLASS} flex w-full flex-col items-center justify-end pb-3 pointer-events-none`}>
      <div className="flex flex-col gap-2 w-fit mx-auto px-2 py-1.5 rounded text-center text-white bg-black/75 pointer-events-auto">
        <Activity mode={showMain ? 'visible' : 'hidden'}>
          <MainSubtitle className={translationAbove ? 'order-2' : 'order-1'} />
        </Activity>

        <Activity mode={showTranslation ? 'visible' : 'hidden'}>
          <TranslationSubtitle className={translationAbove ? 'order-1' : 'order-2'} />
        </Activity>
      </div>
    </div>
  )
}

export function SubtitlesView() {
  const subtitle = useAtomValue(currentSubtitleAtom)
  const { containerRef, handleRef, topPercent } = useVerticalDrag()

  if (!subtitle) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className="group flex flex-col items-center absolute w-full left-0 right-0"
      style={{
        fontFamily: 'Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif',
        top: `${topPercent}%`,
      }}
    >
      <div className="w-full flex justify-center pointer-events-auto">
        <div
          ref={handleRef}
          className="mb-0.5 px-2 py-1 rounded cursor-grab active:cursor-grabbing bg-black/75 opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity duration-200"
        >
          <Icon icon="tabler:grip-horizontal" className="size-4 text-white" />
        </div>
      </div>

      <SubtitlesContent />
    </div>
  )
}
