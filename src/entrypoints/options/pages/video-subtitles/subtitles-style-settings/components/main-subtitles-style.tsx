import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { Button } from '@/components/shadcn/button'
import { Card } from '@/components/shadcn/card'
import { Label } from '@/components/shadcn/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SCALE, DEFAULT_FONT_WEIGHT, DEFAULT_SUBTITLE_COLOR } from '@/utils/constants/subtitles'
import { SubtitlesTextStyleForm } from './subtitles-text-style-form'

export function MainSubtitlesStyle() {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(configFieldsAtomMap.videoSubtitles)

  const resetSubtitlesStyleConfig = () => {
    void setVideoSubtitlesConfig(deepmerge(videoSubtitlesConfig, {
      style: {
        main: {
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon="tabler:typography" className="size-4" />
          <Label className="text-sm font-semibold">{i18n.t('options.videoSubtitles.style.mainSubtitle')}</Label>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="-mr-2" onClick={resetSubtitlesStyleConfig}>
              <Icon icon="tabler:refresh" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{i18n.t('options.videoSubtitles.style.reset')}</TooltipContent>
        </Tooltip>
      </div>

      <SubtitlesTextStyleForm type="main" />
    </Card>
  )
}
