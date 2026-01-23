import { Icon } from '@iconify/react'
import { useAtomValue } from 'jotai'
import { Activity } from 'react'
import { cn } from '@/lib/utils'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { SUBTITLES_VIEW_CLASS } from '@/utils/constants/subtitles'
import { currentSubtitleAtom } from '../atoms'
import { MainSubtitle, TranslationSubtitle } from './subtitle-lines'
import { useVerticalDrag } from './use-vertical-drag'

function SubtitlesContent() {
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const { displayMode, translationPosition, container } = style

  const translationAbove = translationPosition === 'above'
  const showMain = displayMode !== 'translationOnly'
  const showTranslation = displayMode !== 'originalOnly'

  const containerStyle = {
    backgroundColor: `rgba(0, 0, 0, ${container.backgroundOpacity / 100})`,
  }

  return (
    <div className={`${SUBTITLES_VIEW_CLASS} flex w-full flex-col items-center justify-end pb-3 pointer-events-none`}>
      <div
        className="flex flex-col gap-2 w-fit max-w-[80%] mx-auto px-2 py-1.5 rounded text-center text-white pointer-events-auto"
        style={containerStyle}
      >
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

  return (
    <div
      ref={containerRef}
      className={cn(
        'group flex flex-col items-center absolute w-full left-0 right-0',
        !subtitle && 'invisible',
      )}
      style={{
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

      <Activity mode={subtitle ? 'visible' : 'hidden'}>
        <SubtitlesContent />
      </Activity>
    </div>
  )
}
