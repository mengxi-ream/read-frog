import { Icon } from '@iconify/react'
import { useAtomValue } from 'jotai'
import { Activity } from 'react'
import { cn } from '@/lib/utils'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { SUBTITLES_VIEW_CLASS } from '@/utils/constants/subtitles'
import { currentSubtitleAtom } from '../atoms'
import { useVerticalDrag } from './use-vertical-drag'

function SubtitlesContent() {
  const subtitle = useAtomValue(currentSubtitleAtom)
  const { style: { displayMode, translationPosition } } = useAtomValue(configFieldsAtomMap.videoSubtitles)

  if (!subtitle) {
    return null
  }

  const originalLines = subtitle.text.split('\n').filter(line => line.trim())
  const translationLines = subtitle.translation
    ? subtitle.translation.split('\n').filter(line => line.trim())
    : []

  // Determine what to show based on displayMode
  const showOriginal = displayMode !== 'translationOnly'
  const showTranslation = displayMode !== 'originalOnly' && subtitle.translation
  const translationFirst = displayMode === 'bilingual' && translationPosition === 'above'

  return (
    <div className={`${SUBTITLES_VIEW_CLASS} flex w-full flex-col items-center justify-end pb-3 pointer-events-none`}>
      {originalLines.map((line, index) => {
        const translation = translationLines[index] || ''
        const key = `subtitle-line-${line.substring(0, 20)}-${translation.substring(0, 20)}`

        const hasTranslation = showTranslation && translation

        return (
          <div
            key={key}
            className="w-fit mx-auto my-1 px-2 py-1.5 rounded text-center text-white pointer-events-auto"
            style={{ background: 'rgba(0,0,0,0.75)' }}
          >
            <Activity mode={translationFirst && hasTranslation ? 'visible' : 'hidden'}>
              <div className="text-2xl leading-tight mb-1">
                {translation}
              </div>
            </Activity>

            <Activity mode={showOriginal ? 'visible' : 'hidden'}>
              <div
                className={cn(
                  'leading-snug',
                  hasTranslation ? 'text-lg opacity-80' : 'text-2xl',
                )}
              >
                {line}
              </div>
            </Activity>

            <Activity mode={!translationFirst && hasTranslation ? 'visible' : 'hidden'}>
              <div className="text-2xl leading-tight mt-1">
                {translation}
              </div>
            </Activity>
          </div>
        )
      })}
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
