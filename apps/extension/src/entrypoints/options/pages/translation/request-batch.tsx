import type { BatchQueueConfig } from '@/types/config/translate'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { Input } from '@repo/ui/components/input'
import { useAtom } from 'jotai'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useBatchRequestRecords } from '@/hooks/use-batch-request-record'
import { batchQueueConfigSchema } from '@/types/config/translate'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { calculateAverageSavePercentage } from '@/utils/batch-request-record'
import { MIN_BATCH_CHARACTERS, MIN_BATCH_ITEMS } from '@/utils/constants/translate'
import { sendMessage } from '@/utils/message'
import { ConfigCard } from '../../components/config-card'
import { FieldWithLabel } from '../../components/field-with-label'

type KeyOfBatchQueueConfig = keyof BatchQueueConfig

export function RequestBatch() {
  return (
    <ConfigCard
      title={i18n.t('options.translation.batchQueueConfig.title')}
      description={(
        <div className="flex flex-col">
          <span>{i18n.t('options.translation.batchQueueConfig.description')}</span>
          <StatisticsLink />
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        <BatchNumberSelector property="maxCharactersPerBatch" />
        <BatchNumberSelector property="maxItemsPerBatch" />
      </div>
    </ConfigCard>
  )
}

function StatisticsLink() {
  const { currentPeriodRecords } = useBatchRequestRecords(7)

  const averageSavePercentage = calculateAverageSavePercentage(currentPeriodRecords)

  return (
    <Link
      className="text-primary hover:opacity-80 cursor-pointer transition-opacity"
      to="/statistics"
      target="_blank"
    >
      {i18n.t('options.translation.batchQueueConfig.statisticsLink', [averageSavePercentage])}
      {' '}
      <Icon icon="tabler:external-link" className="inline w-3.5 h-3.5" />
    </Link>
  )
}

function BatchCharactersDescription() {
  return (
    <div className="flex flex-col gap-2">
      <h2>{i18n.t('options.translation.batchQueueConfig.maxCharactersPerBatch.title')}</h2>
      <p className="text-xs text-muted-foreground">{i18n.t('options.translation.batchQueueConfig.maxCharactersPerBatch.description')}</p>
    </div>
  )
}

function BatchSizeDescription() {
  return (
    <div className="flex flex-col gap-2 flex-auto">
      <h2>{i18n.t('options.translation.batchQueueConfig.maxItemsPerBatch.title')}</h2>
      <p className="text-xs text-muted-foreground">{i18n.t('options.translation.batchQueueConfig.maxItemsPerBatch.description')}</p>
    </div>
  )
}

const propertyDescription = {
  maxCharactersPerBatch: BatchCharactersDescription,
  maxItemsPerBatch: BatchSizeDescription,
}

const propertyMinValue = {
  maxCharactersPerBatch: MIN_BATCH_CHARACTERS,
  maxItemsPerBatch: MIN_BATCH_ITEMS,
}

function BatchNumberSelector({ property }: { property: KeyOfBatchQueueConfig }) {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { batchQueueConfig } = translateConfig

  const currentConfigValue = batchQueueConfig[property]
  const minAllowedValue = propertyMinValue[property]

  const Description = propertyDescription[property]

  return (
    <FieldWithLabel className="flex-row items-center justify-between gap-4" id={`batch-${property}`} label={<Description />}>
      <Input
        className="mt-1 mb-2 w-40 flex-shrink-0"
        type="number"
        min={minAllowedValue}
        value={currentConfigValue}
        onChange={(e) => {
          const newConfigValue = Number(e.target.value)
          const configParseResult = batchQueueConfigSchema.partial().safeParse({ [property]: newConfigValue })
          if (configParseResult.success) {
            void setTranslateConfig({
              ...translateConfig,
              batchQueueConfig: {
                ...translateConfig.batchQueueConfig,
                [property]: newConfigValue,
              },
            })
            void sendMessage('setTranslateBatchQueueConfig', {
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
