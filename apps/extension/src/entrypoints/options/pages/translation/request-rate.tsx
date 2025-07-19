import type { RequestQueueConfig } from '@/types/config/provider'
import { useAtom } from 'jotai'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { requestQueueConfigSchema } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'
import { MIN_TRANSLATE_CAPACITY, MIN_TRANSLATE_RATE } from '@/utils/constants/translate'
import { sendMessage } from '@/utils/message'
import { ConfigCard } from '../../components/config-card'
import { FieldWithLabel } from '../../components/field-with-label'

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

const propertyMinAllowedValue = {
  capacity: MIN_TRANSLATE_CAPACITY,
  rate: MIN_TRANSLATE_RATE,
}

function TranslateNumberSelector({ property }: { property: KeyOfRequestQueueConfig }) {
  const [translateConfig, setTranslateConfig] = useAtom(configFields.translate)
  const { requestQueueConfig } = translateConfig

  const currentConfigValue = requestQueueConfig[property]
  const minAllowedValue = propertyMinAllowedValue[property]

  const Description = propertyDescription[property]

  return (
    <FieldWithLabel className="flex-row items-center justify-between gap-4" id={`translate-${property}`} label={<Description />}>
      <Input
        className="mt-1 mb-2 w-40 flex-shrink-0"
        type="number"
        min={minAllowedValue}
        value={currentConfigValue}
        onChange={(e) => {
          const newConfigValue = Number(e.target.value)
          const configParseResult = requestQueueConfigSchema.partial().safeParse({ [property]: newConfigValue })
          if (configParseResult.success) {
            setTranslateConfig({
              ...translateConfig,
              requestQueueConfig: {
                ...translateConfig.requestQueueConfig,
                [property]: newConfigValue,
              },
            })
            sendMessage('setTranslateRequestQueueConfig', {
              [property]: newConfigValue,
            })
          }
          else {
            toast.error(configParseResult.error?.issues[0].message)
          }
        }}
      />
    </FieldWithLabel>
  )
}
