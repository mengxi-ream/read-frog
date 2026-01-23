import type { TTSModel, TTSVoice } from '@/types/config/tts'
import { i18n } from '#imports'
import { IconLoader2, IconPlayerPlayFilled } from '@tabler/icons-react'
import { useAtom, useAtomValue } from 'jotai'
import { toast } from 'sonner'
import { Button } from '@/components/base-ui/button'
import { Badge } from '@/components/shadcn/badge'
import { Field, FieldLabel } from '@/components/shadcn/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'
import ValidatedInput from '@/components/ui/validated-input'
import { useTextToSpeech } from '@/hooks/use-text-to-speech'
import { getVoicesForModel, isVoiceAvailableForModel, MAX_TTS_SPEED, MIN_TTS_SPEED, TTS_MODELS, ttsSpeedSchema } from '@/types/config/tts'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ttsProviderConfigAtom } from '@/utils/atoms/provider'
import { getTTSProvidersConfig } from '@/utils/config/helpers'
import { TTS_VOICES_ITEMS } from '@/utils/constants/tts'
import { ConfigCard } from '../../components/config-card'
import { SetApiKeyWarning } from '../../components/set-api-key-warning'

export function TtsConfig() {
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  return (
    <ConfigCard
      title={(
        <>
          {i18n.t('options.tts.title')}
          {' '}
          <Badge variant="secondary" className="align-middle">Public Beta</Badge>
        </>
      )}
      description={i18n.t('options.tts.description')}
    >
      <div className="space-y-4">
        <TtsProviderField />
        {ttsConfig.providerId && (
          <>
            <TtsModelField />
            <TtsVoiceField />
            <TtsSpeedField />
          </>
        )}
      </div>
    </ConfigCard>
  )
}

function TtsProviderField() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const ttsProviderConfig = useAtomValue(ttsProviderConfigAtom)
  const ttsProvidersConfig = getTTSProvidersConfig(providersConfig)

  const selectorPlaceholder = ttsProvidersConfig.length === 0 ? i18n.t('options.tts.provider.noProvider') : i18n.t('options.tts.provider.selectPlaceholder')

  return (
    <Field>
      <FieldLabel htmlFor="ttsProvider">
        {i18n.t('options.tts.provider.label')}
        {ttsProviderConfig && !ttsProviderConfig.apiKey && <SetApiKeyWarning />}
      </FieldLabel>
      <Select
        value={ttsConfig.providerId || undefined}
        onValueChange={(value: string) => {
          void setTtsConfig({ providerId: value })
        }}
        disabled={ttsProvidersConfig.length === 0}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={selectorPlaceholder} id="ttsProvider" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {ttsProvidersConfig.map(provider => (
              <SelectItem key={provider.id} value={provider.id}>
                {provider.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

function TtsModelField() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)

  return (
    <Field>
      <FieldLabel htmlFor="ttsModel">
        {i18n.t('options.tts.model.label')}
      </FieldLabel>
      <Select
        value={ttsConfig.model}
        onValueChange={(value: TTSModel) => {
          // Check if current voice is available for the new model
          const isCurrentVoiceAvailable = isVoiceAvailableForModel(ttsConfig.voice, value)

          // If current voice is not available, select the first available voice
          if (!isCurrentVoiceAvailable) {
            const availableVoices = getVoicesForModel(value)
            void setTtsConfig({
              model: value,
              voice: availableVoices[0] as TTSVoice,
            })
          }
          else {
            void setTtsConfig({ model: value })
          }
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {TTS_MODELS.map(model => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

function TtsVoiceField() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)
  const ttsProviderConfig = useAtomValue(ttsProviderConfigAtom)
  const availableVoices = getVoicesForModel(ttsConfig.model)
  const { play, isFetching, isPlaying } = useTextToSpeech()

  const handlePreview = async () => {
    if (!ttsProviderConfig) {
      toast.error(i18n.t('options.tts.provider.noProvider'))
      return
    }

    void play(
      i18n.t('options.tts.voice.previewSample'),
      ttsConfig,
      ttsProviderConfig,
    )
  }

  const isFetchingOrPlaying = isFetching || isPlaying

  return (
    <Field>
      <FieldLabel htmlFor="ttsVoice">
        {i18n.t('options.tts.voice.label')}
      </FieldLabel>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex flex-1 items-center gap-2">
          <Select
            value={ttsConfig.voice}
            onValueChange={(value: TTSVoice) => {
              void setTtsConfig({ voice: value })
            }}
          >
            <SelectTrigger
              id="ttsVoice"
              className="w-full"
            >
              <SelectValue placeholder={i18n.t('options.tts.voice.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {availableVoices.map(voice => (
                  <SelectItem key={voice} value={voice}>
                    {TTS_VOICES_ITEMS[voice].name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          className="sm:w-auto h-9"
          onClick={handlePreview}
          disabled={isFetchingOrPlaying || !ttsConfig.providerId}
        >
          {isFetchingOrPlaying ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : <IconPlayerPlayFilled className="mr-2 size-4" />}
          {i18n.t('options.tts.voice.preview')}
        </Button>
      </div>
    </Field>
  )
}

function TtsSpeedField() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)

  return (
    <Field>
      <FieldLabel htmlFor="ttsSpeed">
        {i18n.t('options.tts.speed.label')}
      </FieldLabel>
      <ValidatedInput
        id="ttsSpeed"
        type="number"
        step="0.05"
        min={MIN_TTS_SPEED}
        max={MAX_TTS_SPEED}
        value={ttsConfig.speed}
        schema={ttsSpeedSchema}
        onChange={(event) => {
          void setTtsConfig({ speed: Number(event.target.value) })
        }}
      />
      <p className="text-xs text-muted-foreground">
        {i18n.t('options.tts.speed.hint')}
      </p>
    </Field>
  )
}
