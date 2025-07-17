import { useAtom } from 'jotai'
import { Input } from '@/components/ui/input'
import { configFields } from '@/utils/atoms/config'
import { MIN_TRANSLATE_CAPACITY, MIN_TRANSLATE_RATE, REQUEST_RATE_EXPOSE_PROPERTIES } from '@/utils/constants/translate'
import { sendMessage } from '@/utils/message'
import { ConfigCard } from '../../components/config-card'
import { FieldWithLabel } from '../../components/field-with-label'

export function RequestRate() {
  return (
    <ConfigCard
      title={i18n.t('options.translation.requestQueueConfig.title')}
      description={i18n.t('options.translation.requestQueueConfig.description')}
    >
      <div className="flex flex-col gap-4">
        <TranslateNumberSelector property={REQUEST_RATE_EXPOSE_PROPERTIES.Capacity} />
        <TranslateNumberSelector property={REQUEST_RATE_EXPOSE_PROPERTIES.Rate} />
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
  [REQUEST_RATE_EXPOSE_PROPERTIES.Capacity]: CapacityDescription,
  [REQUEST_RATE_EXPOSE_PROPERTIES.Rate]: RateDescription,
}

const propertyMin = {
  [REQUEST_RATE_EXPOSE_PROPERTIES.Capacity]: MIN_TRANSLATE_CAPACITY,
  [REQUEST_RATE_EXPOSE_PROPERTIES.Rate]: MIN_TRANSLATE_RATE,
}

function TranslateNumberSelector(
  { property }:
  { property: REQUEST_RATE_EXPOSE_PROPERTIES },
) {
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
          setTranslateConfig({
            ...translateConfig,
            requestQueueConfig: {
              ...translateConfig.requestQueueConfig,
              [property]: Number(e.target.value),
            },
          })
          sendMessage('setTranslateRequestQueueConfig', {
            [property]: Number(e.target.value),
          })
        }}
      />
    </FieldWithLabel>
  )
}
