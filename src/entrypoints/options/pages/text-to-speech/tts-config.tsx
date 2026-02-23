import type { LangCodeISO6393 } from '@read-frog/definitions'
import type { FocusEvent } from 'react'
import type { TTSVoice } from '@/types/config/tts'
import { i18n } from '#imports'
import { IconLoader2, IconPlayerPlayFilled } from '@tabler/icons-react'
import { useAtom } from 'jotai'
import { useState } from 'react'
import { LanguageCombobox } from '@/components/language-combobox'
import { Badge } from '@/components/ui/base-ui/badge'
import { Button } from '@/components/ui/base-ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/base-ui/field'
import { Input } from '@/components/ui/base-ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/base-ui/select'
import { useTextToSpeech } from '@/hooks/use-text-to-speech'
import {
  EDGE_TTS_VOICES,
  getDefaultTTSVoiceForLanguage,
  MAX_TTS_PITCH,
  MAX_TTS_RATE,
  MAX_TTS_VOLUME,
  MIN_TTS_PITCH,
  MIN_TTS_RATE,
  MIN_TTS_VOLUME,
  ttsPitchSchema,
  ttsRateSchema,
  ttsVolumeSchema,
} from '@/types/config/tts'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

interface TtsNumberFieldProps {
  id: string
  label: string
  hint: string
  value: number
  min: number
  max: number
  schema: typeof ttsRateSchema
  onCommit: (value: number) => void
}

export function TtsConfig() {
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
      <FieldGroup>
        <TtsLanguageVoiceField />
        <TtsDefaultVoiceField />
        <TtsRateField />
        <TtsPitchField />
        <TtsVolumeField />
      </FieldGroup>
    </ConfigCard>
  )
}

function TtsDefaultVoiceField() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)
  const { play, isFetching, isPlaying } = useTextToSpeech()
  const isFetchingOrPlaying = isFetching || isPlaying

  const handlePreview = async () => {
    void play(i18n.t('options.tts.voice.previewSample'), ttsConfig)
  }

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t('options.tts.voice.label')}
        {' '}
        (
        {i18n.t('options.tts.voice.fallback')}
        )
      </FieldLabel>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex flex-1 items-center gap-2">
          <Select
            value={ttsConfig.defaultVoice}
            onValueChange={(value: TTSVoice | null) => {
              if (!value) {
                return
              }
              void setTtsConfig({ defaultVoice: value })
            }}
          >
            <SelectTrigger id="ttsVoice" className="w-full">
              <SelectValue
                className="data-placeholder:opacity-60"
                placeholder={i18n.t('options.tts.voice.selectPlaceholder')}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {EDGE_TTS_VOICES.map(voice => (
                  <SelectItem key={voice} value={voice}>
                    {voice}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 sm:w-auto"
          onClick={handlePreview}
          disabled={isFetchingOrPlaying}
        >
          {isFetchingOrPlaying
            ? <IconLoader2 className="mr-2 size-4 animate-spin" />
            : <IconPlayerPlayFilled className="mr-2 size-4" />}
          {i18n.t('options.tts.voice.preview')}
        </Button>
      </div>
    </Field>
  )
}

function TtsLanguageVoiceField() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)
  const [selectedLanguage, setSelectedLanguage] = useState<LangCodeISO6393>('eng')

  const selectedLanguageVoice = ttsConfig.languageVoices[selectedLanguage] ?? ttsConfig.defaultVoice
  const defaultLanguageVoice = getDefaultTTSVoiceForLanguage(selectedLanguage, ttsConfig.defaultVoice)

  const updateLanguageVoice = (voice: TTSVoice) => {
    void setTtsConfig({
      languageVoices: {
        ...ttsConfig.languageVoices,
        [selectedLanguage]: voice,
      },
    })
  }

  const resetLanguageVoice = () => {
    updateLanguageVoice(defaultLanguageVoice)
  }

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t('options.tts.languageVoice.label')}
      </FieldLabel>
      <div className="space-y-2">
        <LanguageCombobox
          className="w-full"
          value={selectedLanguage}
          onValueChange={(value) => {
            if (value === 'auto') {
              return
            }
            setSelectedLanguage(value)
          }}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex-1">
            <Select
              value={selectedLanguageVoice}
              onValueChange={(value: TTSVoice | null) => {
                if (!value) {
                  return
                }
                updateLanguageVoice(value)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  className="data-[placeholder]:opacity-60"
                  placeholder={i18n.t('options.tts.voice.selectPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {EDGE_TTS_VOICES.map(voice => (
                    <SelectItem key={voice} value={voice}>
                      {voice}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 sm:w-auto"
            onClick={resetLanguageVoice}
            disabled={selectedLanguageVoice === defaultLanguageVoice}
          >
            {i18n.t('options.tts.languageVoice.reset')}
          </Button>
        </div>
      </div>
      <FieldDescription>
        {i18n.t('options.tts.languageVoice.description')}
      </FieldDescription>
    </Field>
  )
}

function TtsNumberField({
  id,
  label,
  hint,
  value,
  min,
  max,
  schema,
  onCommit,
}: TtsNumberFieldProps) {
  const [draftValue, setDraftValue] = useState(() => String(value))

  const validate = (inputValue: unknown) => {
    const parseResult = schema.safeParse(inputValue)
    if (parseResult.success) {
      return null
    }
    return parseResult.error.issues[0]?.message ?? 'Invalid input'
  }

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    const parseResult = schema.safeParse(event.target.value)

    if (!parseResult.success) {
      return
    }

    setDraftValue(String(parseResult.data))
    onCommit(parseResult.data)
  }

  return (
    <Field validationMode="onBlur" validate={validate}>
      <FieldLabel htmlFor={id}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        type="number"
        step="1"
        min={min}
        max={max}
        value={draftValue}
        onChange={(event) => {
          setDraftValue(event.target.value)
        }}
        onBlur={handleBlur}
      />
      <FieldError />
      <FieldDescription>
        {hint}
      </FieldDescription>
    </Field>
  )
}

function TtsRateField() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)

  return (
    <TtsNumberField
      key={ttsConfig.rate}
      id="ttsRate"
      label={i18n.t('options.tts.rate.label')}
      hint={i18n.t('options.tts.rate.hint')}
      value={ttsConfig.rate}
      min={MIN_TTS_RATE}
      max={MAX_TTS_RATE}
      schema={ttsRateSchema}
      onCommit={(rate) => {
        void setTtsConfig({ rate })
      }}
    />
  )
}

function TtsPitchField() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)

  return (
    <TtsNumberField
      key={ttsConfig.pitch}
      id="ttsPitch"
      label={i18n.t('options.tts.pitch.label')}
      hint={i18n.t('options.tts.pitch.hint')}
      value={ttsConfig.pitch}
      min={MIN_TTS_PITCH}
      max={MAX_TTS_PITCH}
      schema={ttsPitchSchema}
      onCommit={(pitch) => {
        void setTtsConfig({ pitch })
      }}
    />
  )
}

function TtsVolumeField() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)

  return (
    <TtsNumberField
      key={ttsConfig.volume}
      id="ttsVolume"
      label={i18n.t('options.tts.volume.label')}
      hint={i18n.t('options.tts.volume.hint')}
      value={ttsConfig.volume}
      min={MIN_TTS_VOLUME}
      max={MAX_TTS_VOLUME}
      schema={ttsVolumeSchema}
      onCommit={(volume) => {
        void setTtsConfig({ volume })
      }}
    />
  )
}
