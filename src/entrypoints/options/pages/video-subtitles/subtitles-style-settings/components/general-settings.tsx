import type { SubtitlesDisplayMode, SubtitlesTranslationPosition } from '@/types/config/config'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { Activity } from 'react'
import { Card } from '@/components/shadcn/card'
import { Label } from '@/components/shadcn/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/shadcn/select'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { MAX_BACKGROUND_OPACITY, MIN_BACKGROUND_OPACITY } from '@/utils/constants/subtitles'

export function GeneralSettings() {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(configFieldsAtomMap.videoSubtitles)
  const { displayMode, translationPosition, container } = videoSubtitlesConfig.style

  const handleDisplayModeChange = (displayMode: SubtitlesDisplayMode) => {
    void setVideoSubtitlesConfig(deepmerge(videoSubtitlesConfig, { style: { displayMode } }))
  }

  const handleTranslationPositionChange = (translationPosition: SubtitlesTranslationPosition) => {
    void setVideoSubtitlesConfig(deepmerge(videoSubtitlesConfig, { style: { translationPosition } }))
  }

  const handleContainerChange = (style: Partial<typeof container>) => {
    void setVideoSubtitlesConfig(deepmerge(videoSubtitlesConfig, { style: { container: style } }))
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon icon="tabler:settings" className="size-4" />
        <Label className="text-sm font-semibold">{i18n.t('options.videoSubtitles.style.generalSettings')}</Label>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Label className="text-sm shrink-0">{i18n.t('options.videoSubtitles.style.displayMode.title')}</Label>
        <Select value={displayMode} onValueChange={handleDisplayModeChange}>
          <SelectTrigger className="w-48 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bilingual">
              {i18n.t('options.videoSubtitles.style.displayMode.bilingual')}
            </SelectItem>
            <SelectItem value="originalOnly">
              {i18n.t('options.videoSubtitles.style.displayMode.originalOnly')}
            </SelectItem>
            <SelectItem value="translationOnly">
              {i18n.t('options.videoSubtitles.style.displayMode.translationOnly')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Activity mode={displayMode === 'bilingual' ? 'visible' : 'hidden'}>
        <div className="flex items-center justify-between gap-4">
          <Label className="text-sm shrink-0">{i18n.t('options.videoSubtitles.style.translationPosition.title')}</Label>
          <Select value={translationPosition} onValueChange={handleTranslationPositionChange}>
            <SelectTrigger className="w-48 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="above">
                {i18n.t('options.videoSubtitles.style.translationPosition.above')}
              </SelectItem>
              <SelectItem value="below">
                {i18n.t('options.videoSubtitles.style.translationPosition.below')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Activity>

      <div className="flex items-center justify-between gap-4">
        <Label className="text-sm shrink-0">{i18n.t('options.videoSubtitles.style.backgroundOpacity')}</Label>
        <div className="flex items-center gap-2 w-48">
          <input
            type="range"
            min={MIN_BACKGROUND_OPACITY}
            max={MAX_BACKGROUND_OPACITY}
            step={5}
            value={container.backgroundOpacity}
            onChange={e => handleContainerChange({ backgroundOpacity: Number(e.target.value) })}
            className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <span className="w-10 text-sm text-right">
            {container.backgroundOpacity}
            %
          </span>
        </div>
      </div>
    </Card>
  )
}
