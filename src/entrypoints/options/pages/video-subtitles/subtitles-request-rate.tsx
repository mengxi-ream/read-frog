import type { RequestQueueConfig } from '@/types/config/translate'
import { i18n } from '#imports'
import { useAtom } from 'jotai'
import { toast } from 'sonner'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/shadcn/field'
import { Hint } from '@/components/shadcn/hint'
import { Input } from '@/components/shadcn/input'
import { requestQueueConfigSchema } from '@/types/config/translate'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import {
  MAX_BASE_RETRY_DELAY_MS,
  MAX_MAX_RETRIES,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_BASE_RETRY_DELAY_MS,
  MIN_MAX_RETRIES,
  MIN_REQUEST_TIMEOUT_MS,
  MIN_TRANSLATE_CAPACITY,
  MIN_TRANSLATE_RATE,
} from '@/utils/constants/translate'
import { sendMessage } from '@/utils/message'
import { ConfigCard } from '../../components/config-card'

type KeyOfRequestQueueConfig = keyof RequestQueueConfig

export function SubtitlesRequestRate() {
  return (
    <ConfigCard
      title={i18n.t('options.videoSubtitles.requestQueueConfig.title')}
      description={(
        <div>
          {i18n.t('options.videoSubtitles.requestQueueConfig.firstOnDescription')}
          <a target="_blank" rel="noopener noreferrer" href="https://en.wikipedia.org/wiki/Token_bucket" aria-label="Learn more about the Token Bucket algorithm on Wikipedia"> Token Bucket </a>
          {i18n.t('options.videoSubtitles.requestQueueConfig.lastOnDescription')}
        </div>
      )}
    >
      <FieldGroup>
        <SubtitlesNumberSelector property="capacity" />
        <SubtitlesNumberSelector property="rate" />
        <SubtitlesNumberSelector property="timeoutMs" />
        <SubtitlesNumberSelector property="maxRetries" />
        <SubtitlesNumberSelector property="baseRetryDelayMs" />
      </FieldGroup>
    </ConfigCard>
  )
}

const propertyInfo = {
  capacity: {
    label: i18n.t('options.videoSubtitles.requestQueueConfig.capacity.title'),
    description: i18n.t('options.videoSubtitles.requestQueueConfig.capacity.description'),
  },
  rate: {
    label: i18n.t('options.videoSubtitles.requestQueueConfig.rate.title'),
    description: i18n.t('options.videoSubtitles.requestQueueConfig.rate.description'),
  },
  timeoutMs: {
    label: i18n.t('options.videoSubtitles.requestQueueConfig.timeoutMs.title'),
    description: i18n.t('options.videoSubtitles.requestQueueConfig.timeoutMs.description'),
  },
  maxRetries: {
    label: i18n.t('options.videoSubtitles.requestQueueConfig.maxRetries.title'),
    description: i18n.t('options.videoSubtitles.requestQueueConfig.maxRetries.description'),
  },
  baseRetryDelayMs: {
    label: i18n.t('options.videoSubtitles.requestQueueConfig.baseRetryDelayMs.title'),
    description: i18n.t('options.videoSubtitles.requestQueueConfig.baseRetryDelayMs.description'),
  },
}

const propertyMinAllowedValue = {
  capacity: MIN_TRANSLATE_CAPACITY,
  rate: MIN_TRANSLATE_RATE,
  timeoutMs: MIN_REQUEST_TIMEOUT_MS,
  maxRetries: MIN_MAX_RETRIES,
  baseRetryDelayMs: MIN_BASE_RETRY_DELAY_MS,
}

const propertyMaxAllowedValue = {
  timeoutMs: MAX_REQUEST_TIMEOUT_MS,
  maxRetries: MAX_MAX_RETRIES,
  baseRetryDelayMs: MAX_BASE_RETRY_DELAY_MS,
}

function SubtitlesNumberSelector({ property }: { property: KeyOfRequestQueueConfig }) {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(configFieldsAtomMap.videoSubtitles)
  const { requestQueueConfig } = videoSubtitlesConfig

  const currentConfigValue = requestQueueConfig[property]
  const minAllowedValue = propertyMinAllowedValue[property]
  const maxAllowedValue = propertyMaxAllowedValue[property as keyof typeof propertyMaxAllowedValue]

  const info = propertyInfo[property]

  return (
    <Field orientation="responsive">
      <FieldContent className="self-center">
        <FieldLabel htmlFor={`subtitles-${property}`}>
          {info.label}
          <Hint content={info.description} />
        </FieldLabel>
      </FieldContent>
      <Input
        id={`subtitles-${property}`}
        className="w-40 shrink-0"
        type="number"
        min={minAllowedValue}
        max={maxAllowedValue}
        value={currentConfigValue}
        onChange={(e) => {
          const newConfigValue = Number(e.target.value)
          const configParseResult = requestQueueConfigSchema.partial().safeParse({ [property]: newConfigValue })
          if (configParseResult.success) {
            void setVideoSubtitlesConfig({
              ...videoSubtitlesConfig,
              requestQueueConfig: {
                ...videoSubtitlesConfig.requestQueueConfig,
                [property]: newConfigValue,
              },
            })
            void sendMessage('setSubtitlesRequestQueueConfig', {
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
