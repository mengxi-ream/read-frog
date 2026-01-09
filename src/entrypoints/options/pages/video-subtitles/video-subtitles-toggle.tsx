import { i18n } from '#imports'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { Badge } from '@/components/shadcn/badge'
import { Field, FieldContent, FieldLabel } from '@/components/shadcn/field'
import { Hint } from '@/components/shadcn/hint'
import { Switch } from '@/components/shadcn/switch'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

export function VideoSubtitlesToggle() {
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
    </ConfigCard>
  )
}
