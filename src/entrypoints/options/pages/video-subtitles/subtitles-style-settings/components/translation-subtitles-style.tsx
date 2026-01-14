import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { Card } from '@/components/shadcn/card'
import { Label } from '@/components/shadcn/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SCALE, DEFAULT_FONT_WEIGHT, DEFAULT_SUBTITLE_COLOR } from '@/utils/constants/subtitles'
import { SubtitlesTextStyleForm } from './subtitles-text-style-form'

export function TranslationSubtitlesStyle() {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(configFieldsAtomMap.videoSubtitles)

  const resetSubtitlesStyleConfig = () => {
    void setVideoSubtitlesConfig(deepmerge(videoSubtitlesConfig, {
      style: {
        translation: {
          fontFamily: DEFAULT_FONT_FAMILY,
          fontScale: DEFAULT_FONT_SCALE,
          color: DEFAULT_SUBTITLE_COLOR,
          fontWeight: DEFAULT_FONT_WEIGHT,
        },
      },
    }))
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon icon="tabler:language" className="size-4" />
          <Label className="text-sm font-semibold">{i18n.t('options.videoSubtitles.style.translationSubtitle')}</Label>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={resetSubtitlesStyleConfig} className="p-1 rounded hover:bg-muted transition-colors">
              <Icon icon="tabler:refresh" className="size-4 text-red-500" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{i18n.t('options.videoSubtitles.style.reset')}</TooltipContent>
        </Tooltip>
      </div>

      <SubtitlesTextStyleForm type="translation" />
    </Card>
  )
}
