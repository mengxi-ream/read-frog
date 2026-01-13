import { i18n } from '#imports'
import { useAtomValue } from 'jotai'
import { Activity } from 'react'
import { Label } from '@/components/shadcn/label'
import { MainSubtitle, TranslationSubtitle } from '@/entrypoints/subtitles.content/ui/subtitle-lines'
import { cn } from '@/lib/utils'
import { configFieldsAtomMap } from '@/utils/atoms/config'

export function SubtitlesPreview() {
  const { style: { displayMode, translationPosition } } = useAtomValue(configFieldsAtomMap.videoSubtitles)

  const sampleOriginal = 'Mr. Kamiya is not fighting against the world, but against things that could make the world take notice.'
  const sampleTranslation = '神谷先生不是在对抗世界，而是在对抗可能让世界为之侧目的事物。'

  const translationAbove = translationPosition === 'above'
  const showMain = displayMode !== 'translationOnly'
  const showTranslation = displayMode !== 'originalOnly'

  const fontFamily = 'Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif'

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
          className="flex flex-col gap-2 px-3 py-2 rounded text-center text-white bg-black/75 max-w-[90%]"
          style={{ fontFamily }}
        >
          <Activity mode={showMain ? 'visible' : 'hidden'}>
            <MainSubtitle content={sampleOriginal} className={cn('text-sm', translationAbove ? 'order-2' : 'order-1')} />
          </Activity>

          <Activity mode={showTranslation ? 'visible' : 'hidden'}>
            <TranslationSubtitle content={sampleTranslation} className={cn('text-sm', translationAbove ? 'order-1' : 'order-2')} />
          </Activity>
        </div>
      </div>
    </div>
  )
}
