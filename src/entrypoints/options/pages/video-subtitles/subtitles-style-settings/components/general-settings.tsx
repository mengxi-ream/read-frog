import type { SubtitlesDisplayMode, SubtitlesTranslationPosition } from '@/types/config/subtitles'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { Activity } from 'react'
import { Card } from '@/components/shadcn/card'
import { Label } from '@/components/shadcn/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/shadcn/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { DEFAULT_BACKGROUND_OPACITY, DEFAULT_DISPLAY_MODE, DEFAULT_TRANSLATION_POSITION, MAX_BACKGROUND_OPACITY, MIN_BACKGROUND_OPACITY } from '@/utils/constants/subtitles'

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

  const resetGeneralConfig = () => {
    void setVideoSubtitlesConfig(deepmerge(videoSubtitlesConfig, {
      style: {
        displayMode: DEFAULT_DISPLAY_MODE,
        translationPosition: DEFAULT_TRANSLATION_POSITION,
        container: {
          backgroundOpacity: DEFAULT_BACKGROUND_OPACITY,
        },
      },
    }))
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon icon="tabler:settings" className="size-4" />
          <Label className="text-sm font-semibold">{i18n.t('options.videoSubtitles.style.generalSettings')}</Label>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={resetGeneralConfig} className="p-1 rounded hover:bg-muted transition-colors">
              <Icon icon="tabler:refresh" className="size-4 text-red-500" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{i18n.t('options.videoSubtitles.style.reset')}</TooltipContent>
        </Tooltip>
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
