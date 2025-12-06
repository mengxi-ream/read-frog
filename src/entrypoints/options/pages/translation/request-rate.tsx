import type { RequestQueueConfig } from '@/types/config/translate'
import { i18n } from '#imports'
import { useAtom } from 'jotai'
import { toast } from 'sonner'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/shadcn/field'
import { Hint } from '@/components/shadcn/hint'
import { Input } from '@/components/shadcn/input'
import { requestQueueConfigSchema } from '@/types/config/translate'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { MIN_TRANSLATE_CAPACITY, MIN_TRANSLATE_RATE } from '@/utils/constants/translate'
import { sendMessage } from '@/utils/message'
import { ConfigCard } from '../../components/config-card'

type KeyOfRequestQueueConfig = keyof RequestQueueConfig

export function RequestRate() {
  return (
    <ConfigCard
      title={i18n.t('options.translation.requestQueueConfig.title')}
      description={(
        <div>
          {i18n.t('options.translation.requestQueueConfig.firstOnDescription')}
          <a target="_blank" rel="noopener noreferrer" href="https://en.wikipedia.org/wiki/Token_bucket" aria-label="Learn more about the Token Bucket algorithm on Wikipedia"> Token Bucket </a>
          {i18n.t('options.translation.requestQueueConfig.lastOnDescription')}
        </div>
      )}
    >
      <FieldGroup>
        <TranslateNumberSelector property="capacity" />
        <TranslateNumberSelector property="rate" />
      </FieldGroup>
    </ConfigCard>
  )
}

const propertyInfo = {
  capacity: {
    label: i18n.t('options.translation.requestQueueConfig.capacity.title'),
    description: i18n.t('options.translation.requestQueueConfig.capacity.description'),
  },
  rate: {
    label: i18n.t('options.translation.requestQueueConfig.rate.title'),
    description: i18n.t('options.translation.requestQueueConfig.rate.description'),
  },
}

const propertyMinAllowedValue = {
  capacity: MIN_TRANSLATE_CAPACITY,
  rate: MIN_TRANSLATE_RATE,
}

function TranslateNumberSelector({ property }: { property: KeyOfRequestQueueConfig }) {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { requestQueueConfig } = translateConfig

  const currentConfigValue = requestQueueConfig[property]
  const minAllowedValue = propertyMinAllowedValue[property]

  const info = propertyInfo[property]

  return (
    <Field orientation="responsive">
      <FieldContent className="self-center">
        <FieldLabel htmlFor={`translate-${property}`}>
          {info.label}
          <Hint content={info.description} />
        </FieldLabel>
      </FieldContent>
      <Input
        id={`translate-${property}`}
        className="w-40 shrink-0"
        type="number"
        min={minAllowedValue}
        value={currentConfigValue}
        onChange={(e) => {
          const newConfigValue = Number(e.target.value)
          const configParseResult = requestQueueConfigSchema.partial().safeParse({ [property]: newConfigValue })
          if (configParseResult.success) {
            void setTranslateConfig({
              ...translateConfig,
              requestQueueConfig: {
                ...translateConfig.requestQueueConfig,
                [property]: newConfigValue,
              },
            })
            void sendMessage('setTranslateRequestQueueConfig', {
              [property]: newConfigValue,
            })
          }
          else {
            toast.error(configParseResult.error?.issues[0].message)
          }
        }}
      />
    </Field>
  )
}
