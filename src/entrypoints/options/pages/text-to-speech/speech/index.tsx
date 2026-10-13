import { useAtom } from "jotai"
import { useEffect, useEffectEvent, useState } from "react"
import { Input } from "@/components/ui/base-ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { Textarea } from "@/components/ui/base-ui/textarea"
import { toastManager } from "@/components/ui/base-ui/toast"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import {
  GEMINI_TTS_STYLE_PRESETS,
  MAX_GEMINI_TTS_STYLE_LENGTH,
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
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { SELECT_CONTENT_PROPS } from "../../../components/select-content-props"

/**
 * How the chosen voice delivers a line. Edge takes three dials, each an offset from how it speaks
 * alone; Gemini takes the delivery in words instead.
 */
export function SpeechSection() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)

  if (ttsConfig.provider === "gemini") {
    return (
      <ConfigSection id="speech" title={i18n.t("options.tts.speech.title")}>
        <VoiceStyleItem />
      </ConfigSection>
    )
  }

  return (
    <ConfigSection id="speech" title={i18n.t("options.tts.speech.title")}>
      <ConfigItem
        id="tts-rate"
        title={i18n.t("options.tts.speech.rate.title")}
        description={i18n.t("options.tts.speech.rate.description")}
      >
        <SpeechDialInput
          value={ttsConfig.rate}
          min={MIN_TTS_RATE}
          max={MAX_TTS_RATE}
          schema={ttsRateSchema}
          onValue={(rate) => {
            void setTtsConfig({ rate })
          }}
        />
      </ConfigItem>
      <ConfigItem
        id="tts-pitch"
        title={i18n.t("options.tts.speech.pitch.title")}
        description={i18n.t("options.tts.speech.pitch.description")}
      >
        <SpeechDialInput
          value={ttsConfig.pitch}
          min={MIN_TTS_PITCH}
          max={MAX_TTS_PITCH}
          schema={ttsPitchSchema}
          onValue={(pitch) => {
            void setTtsConfig({ pitch })
          }}
        />
      </ConfigItem>
      <ConfigItem
        id="tts-volume"
        title={i18n.t("options.tts.speech.volume.title")}
        description={i18n.t("options.tts.speech.volume.description")}
      >
        <SpeechDialInput
          value={ttsConfig.volume}
          min={MIN_TTS_VOLUME}
          max={MAX_TTS_VOLUME}
          schema={ttsVolumeSchema}
          onValue={(volume) => {
            void setTtsConfig({ volume })
          }}
        />
      </ConfigItem>
    </ConfigSection>
  )
}

const CUSTOM_STYLE = "custom"

/**
 * A preset fills the style text in; editing it afterwards turns the pick back into "Custom".
 *
 * Typed text is saved 500 ms after the last keystroke, or when the field is left, rather than on
 * every keystroke: each save writes the whole config, which every open tab then reads again.
 */
function VoiceStyleItem() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)
  const savedStyle = ttsConfig.gemini.style
  const [style, setStyle] = useState(savedStyle)
  const [prevSavedStyle, setPrevSavedStyle] = useState(savedStyle)
  const matchedPreset = GEMINI_TTS_STYLE_PRESETS.find((preset) => preset.style === style.trim())
  const presetValue = matchedPreset?.id ?? CUSTOM_STYLE

  // A style saved elsewhere (another tab, a synced config) replaces the draft.
  if (prevSavedStyle !== savedStyle) {
    setPrevSavedStyle(savedStyle)
    setStyle(savedStyle)
  }

  const saveStyle = (nextStyle: string) => {
    if (nextStyle === savedStyle) return
    void setTtsConfig({ gemini: { ...ttsConfig.gemini, style: nextStyle } })
  }

  const debouncedStyle = useDebouncedValue(style, 500)
  const saveDebouncedStyle = useEffectEvent(() => saveStyle(debouncedStyle))
  useEffect(() => {
    saveDebouncedStyle()
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- the dependency is a re-run trigger, not a value the effect body reads
  }, [debouncedStyle])

  const pickStyle = (nextStyle: string) => {
    setStyle(nextStyle)
    saveStyle(nextStyle)
  }

  return (
    <ConfigItem
      id="tts-voice-style"
      orientation="vertical"
      title={i18n.t("options.tts.speech.style.title")}
      description={i18n.t("options.tts.speech.style.description")}
    >
      <div className="flex flex-col gap-2">
        <Select
          value={presetValue}
          onValueChange={(value: string | null) => {
            const preset = GEMINI_TTS_STYLE_PRESETS.find((item) => item.id === value)
            if (preset) pickStyle(preset.style)
          }}
        >
          <SelectTrigger size="sm" className="w-fit">
            <SelectValue render={<span />}>
              {matchedPreset
                ? i18n.t(`options.tts.speech.style.presets.${matchedPreset.id}`)
                : style.trim()
                  ? i18n.t("options.tts.speech.style.presets.custom")
                  : i18n.t("options.tts.speech.style.presets.none")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent {...SELECT_CONTENT_PROPS}>
            <SelectGroup>
              {GEMINI_TTS_STYLE_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  <div className="flex max-w-80 flex-col gap-0.5 py-0.5">
                    <span>{i18n.t(`options.tts.speech.style.presets.${preset.id}`)}</span>
                    <span className="text-xs whitespace-normal text-muted-foreground">
                      {preset.style}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Textarea
          className="min-h-20"
          maxLength={MAX_GEMINI_TTS_STYLE_LENGTH}
          placeholder={i18n.t("options.tts.speech.style.placeholder")}
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          onBlur={() => saveStyle(style)}
        />
      </div>
    </ConfigItem>
  )
}

/**
 * Every dial takes a minus sign, so the draft is only judged once the field is left — reporting
 * mid-entry would fire on the "-" the reader is still typing a number after.
 */
function SpeechDialInput({
  value,
  min,
  max,
  schema,
  onValue,
}: {
  value: number
  min: number
  max: number
  schema: typeof ttsRateSchema
  onValue: (value: number) => void
}) {
  const [draftValue, setDraftValue] = useState(String(value))
  const [prevValue, setPrevValue] = useState(value)

  // Reset the draft when the config value changes externally
  if (prevValue !== value) {
    setPrevValue(value)
    setDraftValue(String(value))
  }

  return (
    <Input
      className="w-24 shrink-0"
      type="number"
      min={min}
      max={max}
      step={1}
      value={draftValue}
      onChange={(e) => {
        const rawValue = e.target.value
        setDraftValue(rawValue)
        // An empty field coerces to 0, which is a value the reader never asked for
        const parseResult = schema.safeParse(rawValue)
        if (rawValue !== "" && parseResult.success) {
          onValue(parseResult.data)
        }
      }}
      onBlur={() => {
        const parseResult = schema.safeParse(draftValue)
        if (draftValue === "" || !parseResult.success) {
          toastManager.add({
            type: "error",
            title: i18n.t("options.tts.speech.error", [min, max]),
          })
          setDraftValue(String(value))
        }
      }}
    />
  )
}
