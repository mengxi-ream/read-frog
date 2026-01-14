import { i18n } from '#imports'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { Badge } from '@/components/shadcn/badge'
import { Field, FieldContent, FieldLabel } from '@/components/shadcn/field'
import { Hint } from '@/components/shadcn/hint'
import { Switch } from '@/components/shadcn/switch'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

export function SubtitlesConfig() {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(configFieldsAtomMap.videoSubtitles)

  return (
    <ConfigCard
      title={(
        <>
          {i18n.t('options.videoSubtitles.title')}
          {' '}
          <Badge variant="secondary" className="align-middle">Public Beta</Badge>
        </>
      )}
      description={i18n.t('options.videoSubtitles.description')}
    >
      <div className="space-y-6">
        <Field orientation="horizontal">
          <FieldContent className="self-center">
            <FieldLabel htmlFor="video-subtitles-toggle">
              {i18n.t('options.videoSubtitles.enable')}
              <Hint content={i18n.t('options.videoSubtitles.enableDescription')} />
            </FieldLabel>
          </FieldContent>
          <Switch
            id="video-subtitles-toggle"
            checked={videoSubtitlesConfig?.enabled ?? false}
            onCheckedChange={(checked) => {
              void setVideoSubtitlesConfig(
                deepmerge(videoSubtitlesConfig, {
                  enabled: checked,
                }),
              )
            }}
          />
        </Field>

        <Field orientation="horizontal">
          <FieldContent className="self-center">
            <FieldLabel htmlFor="video-subtitles-autostart">
              {i18n.t('options.videoSubtitles.autoStart')}
              <Hint content={i18n.t('options.videoSubtitles.autoStartDescription')} />
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
      </div>
    </ConfigCard>
  )
}
