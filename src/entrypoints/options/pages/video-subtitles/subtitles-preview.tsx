import { i18n } from '#imports'
import { useAtomValue } from 'jotai'
import { Activity } from 'react'
import { Label } from '@/components/shadcn/label'
import { cn } from '@/lib/utils'
import { configFieldsAtomMap } from '@/utils/atoms/config'

export function SubtitlesPreview() {
  const { style: { displayMode, translationPosition } } = useAtomValue(configFieldsAtomMap.videoSubtitles)

  const sampleOriginal = 'Mr. Kamiya is not fighting against the world, but against things that could make the world take notice.'
  const sampleTranslation = '神谷先生不是在对抗世界，而是在对抗可能让世界为之侧目的事物。'

  const showOriginal = displayMode !== 'translationOnly'
  const showTranslation = displayMode !== 'originalOnly'
  const translationFirst = displayMode === 'bilingual' && translationPosition === 'above'

  return (
    <div className="mb-4">
      <Label className="mb-2 block text-sm font-medium">
        {i18n.t('options.videoSubtitles.style.preview')}
      </Label>
      <div
        className="relative w-full h-32 rounded-lg overflow-hidden flex items-center justify-center"
        style={{
          background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
        }}
      >
        <div
          className="px-3 py-2 rounded text-center text-white max-w-[90%]"
          style={{
            background: 'rgba(0,0,0,0.75)',
            fontFamily: 'Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif',
          }}
        >
          <Activity mode={translationFirst && showTranslation ? 'visible' : 'hidden'}>
            <div className="text-base leading-tight mb-0.5">
              {sampleTranslation}
            </div>
          </Activity>

          <Activity mode={showOriginal ? 'visible' : 'hidden'}>
            <div
              className={cn(
                'leading-snug',
                showTranslation ? 'text-sm opacity-80' : 'text-base',
              )}
            >
              {sampleOriginal}
            </div>
          </Activity>

          <Activity mode={!translationFirst && showTranslation ? 'visible' : 'hidden'}>
            <div className="text-base leading-tight mt-0.5">
              {sampleTranslation}
            </div>
          </Activity>
        </div>
      </div>
    </div>
  )
}
