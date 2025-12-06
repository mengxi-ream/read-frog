import type { BatchQueueConfig } from '@/types/config/translate'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { useAtom } from 'jotai'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/shadcn/field'
import { Hint } from '@/components/shadcn/hint'
import { Input } from '@/components/shadcn/input'
import { useBatchRequestRecords } from '@/hooks/use-batch-request-record'
import { batchQueueConfigSchema } from '@/types/config/translate'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { calculateAverageSavePercentage } from '@/utils/batch-request-record'
import { MIN_BATCH_CHARACTERS, MIN_BATCH_ITEMS } from '@/utils/constants/translate'
import { sendMessage } from '@/utils/message'
import { ConfigCard } from '../../components/config-card'

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
      <FieldGroup>
        <BatchNumberSelector property="maxCharactersPerBatch" />
        <BatchNumberSelector property="maxItemsPerBatch" />
      </FieldGroup>
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

const propertyInfo = {
  maxCharactersPerBatch: {
    label: i18n.t('options.translation.batchQueueConfig.maxCharactersPerBatch.title'),
    description: i18n.t('options.translation.batchQueueConfig.maxCharactersPerBatch.description'),
  },
  maxItemsPerBatch: {
    label: i18n.t('options.translation.batchQueueConfig.maxItemsPerBatch.title'),
    description: i18n.t('options.translation.batchQueueConfig.maxItemsPerBatch.description'),
  },
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

  const info = propertyInfo[property]

  return (
    <Field orientation="responsive">
      <FieldContent className="self-center">
        <FieldLabel htmlFor={`batch-${property}`}>
          {info.label}
          <Hint content={info.description} />
        </FieldLabel>
      </FieldContent>
      <Input
        id={`batch-${property}`}
        className="w-40 shrink-0"
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
    </Field>
  )
}
