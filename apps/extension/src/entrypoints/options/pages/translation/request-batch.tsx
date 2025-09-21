import type { RequestBatchConfig } from '@/types/config/translate'
import { i18n } from '#imports'
import { Input } from '@repo/ui/components/input'
import { useAtom } from 'jotai'
import { toast } from 'sonner'
import { requestBatchConfigSchema } from '@/types/config/translate'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { MIN_BATCH_CHARACTERS, MIN_BATCH_SIZE } from '@/utils/constants/translate'
import { sendMessage } from '@/utils/message'
import { ConfigCard } from '../../components/config-card'
import { FieldWithLabel } from '../../components/field-with-label'

type KeyOfRequestBatchConfig = keyof RequestBatchConfig

export function RequestBatch() {
  return (
    <ConfigCard
      title={i18n.t('options.translation.requestBatchConfig.title')}
      description={(
        <div>
          {i18n.t('options.translation.requestBatchConfig.description')}
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        <BatchNumberSelector property="batchCharacters" />
        <BatchNumberSelector property="batchSize" />
      </div>
    </ConfigCard>
  )
}

function BatchCharactersDescription() {
  return (
    <div className="flex flex-col gap-2">
      <h2>{i18n.t('options.translation.requestBatchConfig.batchCharacters.title' as any)}</h2>
      <p className="text-xs text-gray-500">{i18n.t('options.translation.requestBatchConfig.batchCharacters.description' as any)}</p>
    </div>
  )
}

function BatchSizeDescription() {
  return (
    <div className="flex flex-col gap-2 flex-auto">
      <h2>{i18n.t('options.translation.requestBatchConfig.batchSize.title' as any)}</h2>
      <p className="text-xs text-gray-500">{i18n.t('options.translation.requestBatchConfig.batchSize.description' as any)}</p>
    </div>
  )
}

const propertyDescription = {
  batchCharacters: BatchCharactersDescription,
  batchSize: BatchSizeDescription,
}

const propertyMinValue = {
  batchCharacters: MIN_BATCH_CHARACTERS,
  batchSize: MIN_BATCH_SIZE,
}

function BatchNumberSelector({ property }: { property: KeyOfRequestBatchConfig }) {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { requestBatchConfig } = translateConfig

  const currentConfigValue = requestBatchConfig[property]
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
          const configParseResult = requestBatchConfigSchema.partial().safeParse({ [property]: newConfigValue })
          if (configParseResult.success) {
            void setTranslateConfig({
              ...translateConfig,
              requestBatchConfig: {
                ...translateConfig.requestBatchConfig,
                [property]: newConfigValue,
              },
            })
            void sendMessage('setTranslateRequestBatchConfig', {
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
