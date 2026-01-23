import type { SubtitlesDisplayMode, SubtitlesTranslationPosition } from '@/types/config/subtitles'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { Activity } from 'react'
import { Button } from '@/components/shadcn/button'
import { Card } from '@/components/shadcn/card'
import { Field, FieldGroup, FieldLabel } from '@/components/shadcn/field'
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon="tabler:settings" className="size-4" />
          <Label className="text-sm font-semibold">{i18n.t('options.videoSubtitles.style.generalSettings')}</Label>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="-mr-2" onClick={resetGeneralConfig}>
              <Icon icon="tabler:refresh" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{i18n.t('options.videoSubtitles.style.reset')}</TooltipContent>
        </Tooltip>
      </div>

      <FieldGroup>
        <Field orientation="responsive-compact">
          <FieldLabel className="text-sm whitespace-nowrap">{i18n.t('options.videoSubtitles.style.displayMode.title')}</FieldLabel>
          <Select value={displayMode} onValueChange={handleDisplayModeChange}>
            <SelectTrigger className="h-8">
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
        </Field>

        <Activity mode={displayMode === 'bilingual' ? 'visible' : 'hidden'}>
          <Field orientation="responsive-compact">
            <FieldLabel className="text-sm whitespace-nowrap">{i18n.t('options.videoSubtitles.style.translationPosition.title')}</FieldLabel>
            <Select value={translationPosition} onValueChange={handleTranslationPositionChange}>
              <SelectTrigger className="h-8">
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
          </Field>
        </Activity>

        <Field orientation="responsive-compact">
          <FieldLabel className="text-sm whitespace-nowrap">{i18n.t('options.videoSubtitles.style.backgroundOpacity')}</FieldLabel>
          <div className="flex items-center gap-2">
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
        </Field>
      </FieldGroup>
    </Card>
  )
}
