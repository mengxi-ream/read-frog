import { Icon } from '@iconify/react'
import { useAtomValue } from 'jotai'
import { use } from 'react'
import { useDraggable } from '@/entrypoints/selection.content/selection-toolbar/use-draggable'
import { cn } from '@/lib/utils'
import { SUBTITLES_VIEW_CLASS } from '@/utils/constants/subtitles'
import { ShadowWrapperContext } from '@/utils/react-shadow-host/create-shadow-host'
import { currentSubtitleAtom } from '../atoms'

function SubtitlesContent() {
  const subtitle = useAtomValue(currentSubtitleAtom)

  if (!subtitle) {
    return null
  }

  const originalLines = subtitle.text.split('\n').filter(line => line.trim())
  const translationLines = subtitle.translation
    ? subtitle.translation.split('\n').filter(line => line.trim())
    : []

  return (
    <div className={`${SUBTITLES_VIEW_CLASS} flex w-full flex-col items-center justify-end pb-3 pointer-events-none`}>
      {originalLines.map((line, index) => {
        const translation = translationLines[index] || ''
        const key = `subtitle-line-${line.substring(0, 20)}-${translation.substring(0, 20)}`

        return (
          <div
            key={key}
            className="w-fit mx-auto my-1 px-2 py-1.5 rounded text-center text-white pointer-events-auto"
            style={{ background: 'rgba(0,0,0,0.75)' }}
          >
            {translation && (
              <div className="text-2xl leading-tight mb-1">
                {translation}
              </div>
            )}
            <div
              className={cn(
                'leading-snug',
                translation ? 'text-lg opacity-80' : 'text-2xl',
              )}
            >
              {line}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function SubtitlesView() {
  const subtitle = useAtomValue(currentSubtitleAtom)
  const shadowContainer = use(ShadowWrapperContext)

  const { dragRef, containerRef } = useDraggable({
    initialPosition: { x: 0, y: 0 },
    boundaryRef: shadowContainer ? { current: shadowContainer } : undefined,
    margin: 8,
    isVisible: !!subtitle,
  })

  if (!subtitle) {
    return null
  }

  return (
    <div
      ref={containerRef as any}
      className="group flex flex-col items-center absolute w-full bottom-12 left-0 right-0"
      style={{
        fontFamily: 'Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif',
      }}
    >
      <div
        ref={dragRef as any}
        className="pointer-events-auto mb-1 p-1 rounded group-hover:opacity-100 transition-opacity duration-200 cursor-grab active:cursor-grabbing"
        style={{ background: 'rgba(0,0,0,0.75)', opacity: 0.6 }}
      >
        <Icon icon="tabler:grip-horizontal" className="size-4 text-white" />
      </div>

      <SubtitlesContent />
    </div>
  )
}
