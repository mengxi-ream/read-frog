import { i18n } from '#imports'
import { useAtomValue } from 'jotai'
import { Activity } from 'react'
import { GradientBackground } from '@/components/gradient-background'
import { Label } from '@/components/shadcn/label'
import { MainSubtitle, TranslationSubtitle } from '@/entrypoints/subtitles.content/ui/subtitle-lines'
import { cn } from '@/lib/utils'
import { configFieldsAtomMap } from '@/utils/atoms/config'

export function SubtitlesPreview() {
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const { displayMode, translationPosition, container } = style

  const sampleOriginal = 'Mr. Kamiya is not fighting against the world, but against things that could make the world take notice.'
  const sampleTranslation = '神谷先生不是在对抗世界，而是在对抗可能让世界为之侧目的事物。'

  const translationAbove = translationPosition === 'above'
  const showMain = displayMode !== 'translationOnly'
  const showTranslation = displayMode !== 'originalOnly'

  const containerStyle = {
    backgroundColor: `rgba(0, 0, 0, ${container.backgroundOpacity / 100})`,
  }

  return (
    <div className="mb-4">
      <Label className="mb-2 block text-sm font-medium">
        {i18n.t('options.videoSubtitles.style.preview')}
      </Label>
      <GradientBackground>
        <div className="relative w-fit min-w-full h-fit min-h-32 rounded-lg overflow-hidden flex items-center justify-center p-4">
          <div
            className="flex flex-col gap-2 px-3 py-2 rounded text-center text-white max-w-[90%]"
            style={containerStyle}
          >
            <Activity mode={showMain ? 'visible' : 'hidden'}>
              <MainSubtitle content={sampleOriginal} className={cn('text-sm', translationAbove ? 'order-2' : 'order-1')} />
            </Activity>

            <Activity mode={showTranslation ? 'visible' : 'hidden'}>
              <TranslationSubtitle content={sampleTranslation} className={cn('text-sm', translationAbove ? 'order-1' : 'order-2')} />
            </Activity>
          </div>
        </div>
      </GradientBackground>
    </div>
  )
}
