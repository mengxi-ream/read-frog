import { i18n } from '#imports'
import { useAtom } from 'jotai'
import ProviderSelector from '@/components/llm-providers/provider-selector'
import { Field, FieldLabel } from '@/components/ui/base-ui/field'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

export function InputTranslationProvider() {
  const [inputTranslation, setInputTranslation] = useAtom(configFieldsAtomMap.inputTranslation)

  return (
    <ConfigCard
      title={i18n.t('options.inputTranslation.provider.title')}
      description={i18n.t('options.inputTranslation.provider.description')}
    >
      <Field>
        <FieldLabel>{i18n.t('options.inputTranslation.provider.label')}</FieldLabel>
        <ProviderSelector
          featureKey="inputTranslation"
          value={inputTranslation.providerId}
          onChange={id => void setInputTranslation({ ...inputTranslation, providerId: id })}
          className="w-full"
        />
      </Field>
    </ConfigCard>
  )
}
