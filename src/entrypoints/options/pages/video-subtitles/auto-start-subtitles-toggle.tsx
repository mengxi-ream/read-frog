import { i18n } from '#imports'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { Field, FieldContent, FieldLabel } from '@/components/shadcn/field'
import { Switch } from '@/components/shadcn/switch'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

export function AutoStartSubtitlesToggle() {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(configFieldsAtomMap.videoSubtitles)

  return (
    <ConfigCard
      title={i18n.t('options.videoSubtitles.autoStart')}
      description={i18n.t('options.videoSubtitles.autoStartDescription')}
    >
      <Field orientation="horizontal">
        <FieldContent className="self-center">
          <FieldLabel htmlFor="video-subtitles-autostart">
            {i18n.t('options.videoSubtitles.autoStart')}
          </FieldLabel>
        </FieldContent>
        <Switch
          id="video-subtitles-autostart"
          checked={videoSubtitlesConfig?.autoStart ?? false}
          onCheckedChange={(checked) => {
            void setVideoSubtitlesConfig(
              deepmerge(videoSubtitlesConfig, {
                autoStart: checked,
              }),
            )
          }}
        />
      </Field>
    </ConfigCard>
  )
}
