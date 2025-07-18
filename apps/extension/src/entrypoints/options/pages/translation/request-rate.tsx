import { useAtom } from 'jotai'
import { Input } from '@/components/ui/input'
import { requestQueueConfigSchema } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'
import { MIN_TRANSLATE_CAPACITY, MIN_TRANSLATE_RATE } from '@/utils/constants/translate'
import { sendMessage } from '@/utils/message'
import { ConfigCard } from '../../components/config-card'
import { FieldWithLabel } from '../../components/field-with-label'

type Prop = 'capacity' | 'rate'

export function RequestRate() {
  return (
    <ConfigCard
      title={i18n.t('options.translation.requestQueueConfig.title')}
      description={(
        <div>
          {i18n.t('options.translation.requestQueueConfig.firstOnDescription')}
          <a target="_blank" rel="noopener noreferrer" href="https://en.wikipedia.org/wiki/Token_bucket"> Token Bucket </a>
          {i18n.t('options.translation.requestQueueConfig.lastOnDescription')}
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        <TranslateNumberSelector property="capacity" />
        <TranslateNumberSelector property="rate" />
      </div>
    </ConfigCard>
  )
}

function CapacityDescription() {
  return (
    <div className="flex flex-col gap-2">
      <h2>{i18n.t('options.translation.requestQueueConfig.capacity.title')}</h2>
      <p className="text-xs text-gray-500">{i18n.t('options.translation.requestQueueConfig.capacity.description')}</p>
    </div>
  )
}

function RateDescription() {
  return (
    <div className="flex flex-col gap-2 flex-auto">
      <h2>{i18n.t('options.translation.requestQueueConfig.rate.title')}</h2>
      <p className="text-xs text-gray-500">{i18n.t('options.translation.requestQueueConfig.rate.description')}</p>
    </div>
  )
}

const propertyDescription = {
  capacity: CapacityDescription,
  rate: RateDescription,
}

const propertyMin = {
  capacity: MIN_TRANSLATE_CAPACITY,
  rate: MIN_TRANSLATE_RATE,
}

function TranslateNumberSelector({ property }: { property: Prop }) {
  const [translateConfig, setTranslateConfig] = useAtom(configFields.translate)
  const { requestQueueConfig } = translateConfig

  const value = requestQueueConfig[property]
  const min = propertyMin[property]

  const Description = propertyDescription[property]

  return (
    <FieldWithLabel className="flex-row items-center justify-between gap-4" id={`translate-${property}`} label={<Description />}>
      <Input
        className="mt-1 mb-2 w-40 flex-shrink-0"
        type="number"
        min={min}
        value={value}
        onChange={(e) => {
          const _value = Number(e.target.value)
          if (requestQueueConfigSchema.partial().safeParse({ [property]: _value }).success) {
            setTranslateConfig({
              ...translateConfig,
              requestQueueConfig: {
                ...translateConfig.requestQueueConfig,
                [property]: _value,
              },
            })
            sendMessage('setTranslateRequestQueueConfig', {
              [property]: _value,
            })
          }
        }}
      />
    </FieldWithLabel>
  )
}
