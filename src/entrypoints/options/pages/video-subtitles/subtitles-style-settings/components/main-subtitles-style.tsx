import type { SubtitleTextStyle } from '@/types/config/config'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { Card } from '@/components/shadcn/card'
import { Label } from '@/components/shadcn/label'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { SubtitlesTextStyleForm } from './subtitles-text-style-form'

export function MainSubtitlesStyle() {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(configFieldsAtomMap.videoSubtitles)
  const textStyle = videoSubtitlesConfig.style.main

  const handleChange = (style: Partial<SubtitleTextStyle>) => {
    void setVideoSubtitlesConfig(deepmerge(videoSubtitlesConfig, { style: { main: style } }))
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon icon="tabler:typography" className="size-4" />
        <Label className="text-sm font-semibold">{i18n.t('options.videoSubtitles.style.mainSubtitle')}</Label>
      </div>

      <SubtitlesTextStyleForm textStyle={textStyle} onChange={handleChange} />
    </Card>
  )
}
