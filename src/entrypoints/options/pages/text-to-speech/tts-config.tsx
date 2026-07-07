import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { FocusEvent } from "react"
import type { TTSVoice, TTSVoiceGroup, TTSVoiceItem } from "@/types/config/tts"
import { IconLoader2, IconPlayerPlayFilled } from "@tabler/icons-react"
import { useAtom } from "jotai"
import { useState } from "react"
import { LanguageCombobox } from "@/components/language-combobox"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/base-ui/combobox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/base-ui/item"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import {
  EDGE_TTS_VOICE_GROUPS,
  getDefaultTTSVoiceForLanguage,
  getEdgeTTSVoiceItem,
  MAX_TTS_PITCH,
  MAX_TTS_RATE,
  MAX_TTS_VOLUME,
  MIN_TTS_PITCH,
  MIN_TTS_RATE,
  MIN_TTS_VOLUME,
  ttsPitchSchema,
  ttsRateSchema,
  ttsVolumeSchema,
} from "@/types/config/tts"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"

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

function getTTSVoiceGenderBadgeClass(gender: TTSVoiceItem["gender"]): string | undefined {
  if (gender.startsWith("Male")) {
    return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
  }

  if (gender.startsWith("Female")) {
    return "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300"
  }

  if (gender === "Neutral") {
    return "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
  }

  return undefined
}

function TTSVoiceSelectValue({ voice }: { voice: TTSVoice }) {
  return <span className="block min-w-0 max-w-full truncate">{voice}</span>
}

function getTTSVoiceSearchValue(item: TTSVoiceItem): string {
  return `${item.voice} ${item.language} ${item.type} ${item.gender}`
}

function filterTTSVoiceItem(item: TTSVoiceItem, query: string): boolean {
  return getTTSVoiceSearchValue(item).toLowerCase().includes(query.toLowerCase())
}

function TTSVoiceComboboxItem({ item }: { item: TTSVoiceItem }) {
  return (
    <ComboboxItem
      key={item.voice}
      value={item}
      className="overflow-hidden py-1.5"
    >
      <Item size="sm" className="w-full min-w-0 max-w-[calc(var(--anchor-width)_-_2.5rem)] flex-nowrap gap-2 overflow-hidden p-0">
        <ItemContent className="min-w-0 gap-1 overflow-hidden">
          <ItemTitle className="w-full min-w-0 max-w-full overflow-hidden font-mono text-xs">
            <span className="block min-w-0 truncate">
              {item.voice}
            </span>
          </ItemTitle>
          <ItemDescription className="m-0 flex min-w-0 max-w-full flex-wrap items-center gap-1.5 overflow-hidden">
            <Badge variant="secondary" size="sm">
              {item.type}
            </Badge>
            <Badge
              variant="secondary"
              size="sm"
              className={getTTSVoiceGenderBadgeClass(item.gender)}
            >
              {item.gender}
            </Badge>
          </ItemDescription>
        </ItemContent>
      </Item>
    </ComboboxItem>
  )
}

function TTSVoiceComboboxGroup({ group }: { group: TTSVoiceGroup }) {
  return (
    <ComboboxGroup
      key={group.language}
      items={group.items}
      className="[&:last-child_[data-slot=combobox-separator]]:hidden"
    >
      <ComboboxLabel className="max-w-full truncate">{group.language}</ComboboxLabel>
      <ComboboxCollection>
        {(item: TTSVoiceItem) => (
          <TTSVoiceComboboxItem key={item.voice} item={item} />
        )}
      </ComboboxCollection>
      <ComboboxSeparator />
    </ComboboxGroup>
  )
}

interface TTSVoiceComboboxProps {
  id?: string
  value: TTSVoice
  onValueChange: (voice: TTSVoice) => void
}

function TTSVoiceCombobox({ id, value, onValueChange }: TTSVoiceComboboxProps) {
  const selectedItem = getEdgeTTSVoiceItem(value)
  const placeholder = i18n.t("options.tts.voice.selectPlaceholder")

  return (
    <Combobox
      value={selectedItem}
      onValueChange={(item: TTSVoiceItem | null) => {
        if (!item) {
          return
        }
        onValueChange(item.voice)
      }}
      items={EDGE_TTS_VOICE_GROUPS}
      filter={filterTTSVoiceItem}
      itemToStringLabel={item => item.voice}
      itemToStringValue={item => item.voice}
      isItemEqualToValue={(item, selectedValue) => item.voice === selectedValue.voice}
      autoHighlight
    >
      <ComboboxTrigger
        render={(
          <Button
            id={id}
            type="button"
            variant="outline"
            className="w-full min-w-0 justify-between font-normal"
          />
        )}
      >
        <ComboboxValue placeholder={placeholder}>
          {(item: TTSVoiceItem | null) => (
            <TTSVoiceSelectValue voice={item?.voice ?? value} />
          )}
        </ComboboxValue>
      </ComboboxTrigger>
      <ComboboxContent className="max-h-80 !min-w-(--anchor-width)">
        <ComboboxInput showTrigger={false} placeholder={placeholder} />
        <ComboboxList>
          {(group: TTSVoiceGroup) => (
            <TTSVoiceComboboxGroup key={group.language} group={group} />
          )}
        </ComboboxList>
        <ComboboxEmpty>{i18n.t("options.tts.voice.noVoicesFound")}</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  )
}

export function TtsConfig() {
  return (
    <ConfigCard
      id="tts-config"
      title={(
        <>
          {i18n.t("options.tts.title")}
          {" "}
          <Badge variant="secondary" className="align-middle">Public Beta</Badge>
        </>
      )}
      description={i18n.t("options.tts.description")}
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

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t("options.tts.voice.label")}
        {" "}
        (
        {i18n.t("options.tts.voice.fallback")}
        )
      </FieldLabel>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TTSVoiceCombobox
            id="ttsVoice"
            value={ttsConfig.defaultVoice}
            onValueChange={(voice) => {
              void setTtsConfig({ defaultVoice: voice })
            }}
          />
        </div>
      </div>
    </Field>
  )
}

function TtsLanguageVoiceField() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)
  const [selectedLanguage, setSelectedLanguage] = useState<LangCodeISO6393>("eng")
  const { play, isFetching, isPlaying } = useTextToSpeech(ANALYTICS_SURFACE.TTS_SETTINGS)
  const isFetchingOrPlaying = isFetching || isPlaying

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

  const handlePreview = async () => {
    void play(i18n.t("options.tts.voice.previewSample"), ttsConfig, {
      forcedVoice: selectedLanguageVoice,
    })
  }

  const resetLanguageVoice = () => {
    updateLanguageVoice(defaultLanguageVoice)
  }

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t("options.tts.languageVoice.label")}
      </FieldLabel>
      <div className="flex flex-col gap-2">
        <LanguageCombobox
          className="w-full"
          value={selectedLanguage}
          onValueChange={(value) => {
            if (value === "auto") {
              return
            }
            setSelectedLanguage(value)
          }}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1">
            <TTSVoiceCombobox
              value={selectedLanguageVoice}
              onValueChange={(voice) => {
                updateLanguageVoice(voice)
              }}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={i18n.t("action.speak")}
            title={i18n.t("action.speak")}
            onClick={handlePreview}
            disabled={isFetchingOrPlaying}
          >
            {isFetchingOrPlaying
              ? <IconLoader2 className="animate-spin" />
              : <IconPlayerPlayFilled />}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="sm:w-auto"
            onClick={resetLanguageVoice}
            disabled={selectedLanguageVoice === defaultLanguageVoice}
          >
            {i18n.t("options.tts.languageVoice.reset")}
          </Button>
        </div>
      </div>
      <FieldDescription>
        {i18n.t("options.tts.languageVoice.description")}
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
    return parseResult.error.issues[0]?.message ?? "Invalid input"
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
      label={i18n.t("options.tts.rate.label")}
      hint={i18n.t("options.tts.rate.hint")}
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
      label={i18n.t("options.tts.pitch.label")}
      hint={i18n.t("options.tts.pitch.hint")}
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
      label={i18n.t("options.tts.volume.label")}
      hint={i18n.t("options.tts.volume.hint")}
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
