import type { BatchQueueConfig } from '@/types/config/translate'
import { i18n } from '#imports'
import { useAtom } from 'jotai'
import { toast } from 'sonner'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/shadcn/field'
import { Hint } from '@/components/shadcn/hint'
import { Input } from '@/components/shadcn/input'
import { batchQueueConfigSchema } from '@/types/config/translate'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { MIN_BATCH_CHARACTERS, MIN_BATCH_ITEMS } from '@/utils/constants/translate'
import { sendMessage } from '@/utils/message'
import { ConfigCard } from '../../components/config-card'

type KeyOfBatchQueueConfig = keyof BatchQueueConfig

export function SubtitlesRequestBatch() {
  return (
    <ConfigCard
      title={i18n.t('options.videoSubtitles.batchQueueConfig.title')}
      description={i18n.t('options.videoSubtitles.batchQueueConfig.description')}
    >
      <FieldGroup>
        <SubtitlesBatchNumberSelector property="maxCharactersPerBatch" />
        <SubtitlesBatchNumberSelector property="maxItemsPerBatch" />
      </FieldGroup>
    </ConfigCard>
  )
}

const propertyInfo = {
  maxCharactersPerBatch: {
    label: i18n.t('options.videoSubtitles.batchQueueConfig.maxCharactersPerBatch.title'),
    description: i18n.t('options.videoSubtitles.batchQueueConfig.maxCharactersPerBatch.description'),
  },
  maxItemsPerBatch: {
    label: i18n.t('options.videoSubtitles.batchQueueConfig.maxItemsPerBatch.title'),
    description: i18n.t('options.videoSubtitles.batchQueueConfig.maxItemsPerBatch.description'),
  },
}

const propertyMinValue = {
  maxCharactersPerBatch: MIN_BATCH_CHARACTERS,
  maxItemsPerBatch: MIN_BATCH_ITEMS,
}

function SubtitlesBatchNumberSelector({ property }: { property: KeyOfBatchQueueConfig }) {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(configFieldsAtomMap.videoSubtitles)
  const { batchQueueConfig } = videoSubtitlesConfig

  const currentConfigValue = batchQueueConfig[property]
  const minAllowedValue = propertyMinValue[property]

  const info = propertyInfo[property]

  return (
    <Field orientation="responsive">
      <FieldContent className="self-center">
        <FieldLabel htmlFor={`subtitles-batch-${property}`}>
          {info.label}
          <Hint content={info.description} />
        </FieldLabel>
      </FieldContent>
      <Input
        id={`subtitles-batch-${property}`}
        className="w-40 shrink-0"
        type="number"
        min={minAllowedValue}
        value={currentConfigValue}
        onChange={(e) => {
          const newConfigValue = Number(e.target.value)
          const configParseResult = batchQueueConfigSchema.partial().safeParse({ [property]: newConfigValue })
          if (configParseResult.success) {
            void setVideoSubtitlesConfig({
              ...videoSubtitlesConfig,
              batchQueueConfig: {
                ...videoSubtitlesConfig.batchQueueConfig,
                [property]: newConfigValue,
              },
            })
            void sendMessage('setSubtitlesBatchQueueConfig', {
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
