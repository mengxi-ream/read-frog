import type { SubtitlesDisplayMode, SubtitlesTranslationPosition } from '@/types/config/config'
import { i18n } from '#imports'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { Activity } from 'react'
import { Label } from '@/components/shadcn/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/shadcn/select'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'
import { SubtitlesPreview } from './subtitles-preview'

export function SubtitlesStyleSettings() {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(configFieldsAtomMap.videoSubtitles)

  const { displayMode, translationPosition } = videoSubtitlesConfig.style

  const handleDisplayModeChange = (displayMode: SubtitlesDisplayMode) => {
    void setVideoSubtitlesConfig(deepmerge(videoSubtitlesConfig, { style: { displayMode } }))
  }

  const handleTranslationPositionChange = (translationPosition: SubtitlesTranslationPosition) => {
    void setVideoSubtitlesConfig(deepmerge(videoSubtitlesConfig, { style: { translationPosition } }))
  }

  return (
    <ConfigCard
      title={i18n.t('options.videoSubtitles.style.title')}
      description={i18n.t('options.videoSubtitles.style.description')}
    >
      <SubtitlesPreview />

      <div className="mt-4 mb-4">
        <Label className="mb-2 block text-sm font-medium">
          {i18n.t('options.videoSubtitles.style.displayMode.title')}
        </Label>
        <Select value={displayMode} onValueChange={handleDisplayModeChange}>
          <SelectTrigger className="w-full">
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
        <div>
          <Label className="mb-2 block text-sm font-medium">
            {i18n.t('options.videoSubtitles.style.translationPosition.title')}
          </Label>
          <Select value={translationPosition} onValueChange={handleTranslationPositionChange}>
            <SelectTrigger className="w-full">
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
    </ConfigCard>
  )
}
