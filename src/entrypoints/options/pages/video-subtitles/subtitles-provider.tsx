import { i18n } from '#imports'
import { useAtom } from 'jotai'
import ProviderSelector from '@/components/llm-providers/provider-selector'
import { Field, FieldLabel } from '@/components/ui/base-ui/field'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

export function SubtitlesProvider() {
  const [videoSubtitles, setVideoSubtitles] = useAtom(configFieldsAtomMap.videoSubtitles)

  return (
    <ConfigCard
      title={i18n.t('options.videoSubtitles.provider.title')}
      description={i18n.t('options.videoSubtitles.provider.description')}
    >
      <Field>
        <FieldLabel>{i18n.t('options.videoSubtitles.provider.label')}</FieldLabel>
        <ProviderSelector
          featureKey="videoSubtitles"
          value={videoSubtitles.providerId}
          onChange={id => void setVideoSubtitles({ ...videoSubtitles, providerId: id })}
          className="w-full"
        />
      </Field>
    </ConfigCard>
  )
}
