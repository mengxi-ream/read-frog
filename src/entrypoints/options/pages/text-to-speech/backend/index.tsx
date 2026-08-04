import type { FocusEvent } from "react"
import type { ZodType } from "zod"
import { IconLoader2, IconPlayerPlayFilled } from "@tabler/icons-react"
import { useAtom } from "jotai"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import {
  MAX_OPENAI_COMPATIBLE_TTS_SPEED,
  MIN_OPENAI_COMPATIBLE_TTS_SPEED,
  OPENAI_COMPATIBLE_TTS_RESPONSE_FORMATS,
  openAICompatibleTTSSpeedSchema,
} from "@/types/config/tts"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"

export function TTSBackendSection() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)

  return (
    <ConfigSection id="tts-backend" title={i18n.t("options.tts.backend.label")}>
      <ConfigItem
        id="tts-backend-provider"
        title={i18n.t("options.tts.backend.label")}
        description={i18n.t("options.tts.backend.description")}
      >
        <Select
          value={ttsConfig.backend}
          onValueChange={(backend) => {
            if (backend === "edge" || backend === "openai-compatible") {
              void setTtsConfig({ backend })
            }
          }}
        >
          <SelectTrigger
            className="w-64 max-w-full"
            aria-label={i18n.t("options.tts.backend.label")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="edge">{i18n.t("options.tts.backend.edge")}</SelectItem>
              <SelectItem value="openai-compatible">
                {i18n.t("options.tts.backend.openAICompatible")}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </ConfigItem>
    </ConfigSection>
  )
}

export function OpenAICompatibleTTSSection() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)
  const { play, isFetching, isPlaying } = useTextToSpeech(ANALYTICS_SURFACE.TTS_SETTINGS)
  const externalConfig = ttsConfig.openAICompatible
  const isFetchingOrPlaying = isFetching || isPlaying

  const updateExternalConfig = (patch: Partial<typeof externalConfig>) => {
    return setTtsConfig({
      openAICompatible: {
        ...externalConfig,
        ...patch,
      },
    })
  }

  return (
    <ConfigSection
      id="openai-compatible-tts"
      title={i18n.t("options.tts.backend.openAICompatible")}
    >
      <TtsTextItem
        id="externalTtsBaseURL"
        label={i18n.t("options.tts.external.baseURL.label")}
        hint={i18n.t("options.tts.external.baseURL.hint")}
        value={externalConfig.baseURL}
        onCommit={(baseURL) => void updateExternalConfig({ baseURL })}
      />
      <TtsTextItem
        id="externalTtsApiKey"
        label={i18n.t("options.tts.external.apiKey.label")}
        hint={i18n.t("options.tts.external.apiKey.hint")}
        value={externalConfig.apiKey}
        type="password"
        allowEmpty
        onCommit={(apiKey) => void updateExternalConfig({ apiKey })}
      />
      <TtsTextItem
        id="externalTtsModel"
        label={i18n.t("options.tts.external.model.label")}
        value={externalConfig.model}
        onCommit={(model) => void updateExternalConfig({ model })}
      />
      <TtsTextItem
        id="externalTtsVoice"
        label={i18n.t("options.tts.external.voice.label")}
        value={externalConfig.voice}
        onCommit={(voice) => void updateExternalConfig({ voice })}
      />
      <ConfigItem
        id="external-tts-response-format"
        title={i18n.t("options.tts.external.responseFormat.label")}
        description={i18n.t("options.tts.external.responseFormat.label")}
      >
        <Select
          value={externalConfig.responseFormat}
          onValueChange={(responseFormat) => {
            if (responseFormat && OPENAI_COMPATIBLE_TTS_RESPONSE_FORMATS.includes(responseFormat)) {
              void updateExternalConfig({ responseFormat })
            }
          }}
        >
          <SelectTrigger
            className="w-40 max-w-full"
            aria-label={i18n.t("options.tts.external.responseFormat.label")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {OPENAI_COMPATIBLE_TTS_RESPONSE_FORMATS.map((format) => (
                <SelectItem key={format} value={format}>
                  {format.toUpperCase()}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </ConfigItem>
      <TtsNumberItem
        id="externalTtsSpeed"
        label={i18n.t("options.tts.external.speed.label")}
        hint={i18n.t("options.tts.external.speed.hint")}
        value={externalConfig.speed}
        min={MIN_OPENAI_COMPATIBLE_TTS_SPEED}
        max={MAX_OPENAI_COMPATIBLE_TTS_SPEED}
        step="0.05"
        schema={openAICompatibleTTSSpeedSchema}
        onCommit={(speed) => void updateExternalConfig({ speed })}
      />
      <TtsTextItem
        id="externalTtsInstructions"
        label={i18n.t("options.tts.external.instructions.label")}
        hint={i18n.t("options.tts.external.instructions.hint")}
        value={externalConfig.instructions}
        allowEmpty
        onCommit={(instructions) => void updateExternalConfig({ instructions })}
      />
      <ConfigItem
        id="external-tts-preview"
        title={i18n.t("options.tts.external.preview")}
        description={i18n.t("options.tts.pageDescription")}
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void play(i18n.t("options.tts.voice.language.previewSample"), ttsConfig)
          }}
          disabled={isFetchingOrPlaying}
        >
          {isFetchingOrPlaying ? (
            <IconLoader2 className="animate-spin" />
          ) : (
            <IconPlayerPlayFilled />
          )}
          {i18n.t("options.tts.external.preview")}
        </Button>
      </ConfigItem>
    </ConfigSection>
  )
}

interface TtsTextItemProps {
  id: string
  label: string
  hint?: string
  value: string
  type?: "text" | "password"
  allowEmpty?: boolean
  onCommit: (value: string) => void
}

function TtsTextItem({
  id,
  label,
  hint,
  value,
  type = "text",
  allowEmpty = false,
  onCommit,
}: TtsTextItemProps) {
  const [draftValue, setDraftValue] = useState(value)

  useEffect(() => {
    setDraftValue(value)
  }, [value])

  return (
    <ConfigItem id={`${id}-item`} title={label} description={hint ?? label}>
      <Field
        className="w-80 max-w-full"
        validationMode="onBlur"
        validate={(inputValue) => {
          if (allowEmpty || String(inputValue).trim()) {
            return null
          }
          return i18n.t("options.tts.external.required")
        }}
      >
        <FieldLabel className="sr-only" htmlFor={id}>
          {label}
        </FieldLabel>
        <Input
          id={id}
          type={type}
          value={draftValue}
          onChange={(event) => {
            setDraftValue(event.target.value)
          }}
          onBlur={() => {
            const nextValue = allowEmpty ? draftValue : draftValue.trim()
            if ((allowEmpty || nextValue) && nextValue !== value) {
              onCommit(nextValue)
            }
          }}
        />
        <FieldError />
      </Field>
    </ConfigItem>
  )
}

interface TtsNumberItemProps {
  id: string
  label: string
  hint: string
  value: number
  min: number
  max: number
  schema: ZodType<number>
  step?: string
  onCommit: (value: number) => void
}

function TtsNumberItem({
  id,
  label,
  hint,
  value,
  min,
  max,
  schema,
  step = "1",
  onCommit,
}: TtsNumberItemProps) {
  const [draftValue, setDraftValue] = useState(() => String(value))

  useEffect(() => {
    setDraftValue(String(value))
  }, [value])

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    const parseResult = schema.safeParse(event.target.value)
    if (!parseResult.success) return

    setDraftValue(String(parseResult.data))
    if (parseResult.data !== value) {
      onCommit(parseResult.data)
    }
  }

  return (
    <ConfigItem id={`${id}-item`} title={label} description={hint}>
      <Field
        className="w-32 max-w-full"
        validationMode="onBlur"
        validate={(inputValue) => {
          const parseResult = schema.safeParse(inputValue)
          return parseResult.success
            ? null
            : (parseResult.error.issues[0]?.message ?? "Invalid input")
        }}
      >
        <FieldLabel className="sr-only" htmlFor={id}>
          {label}
        </FieldLabel>
        <Input
          id={id}
          type="number"
          step={step}
          min={min}
          max={max}
          value={draftValue}
          onChange={(event) => {
            setDraftValue(event.target.value)
          }}
          onBlur={handleBlur}
        />
        <FieldError />
        <FieldDescription className="sr-only">{hint}</FieldDescription>
      </Field>
    </ConfigItem>
  )
}
