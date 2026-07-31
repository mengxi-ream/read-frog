import { useAtom } from "jotai"
import { useState } from "react"
import { Input } from "@/components/ui/base-ui/input"
import { toastManager } from "@/components/ui/base-ui/toast"
import {
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

/** How the chosen voice delivers a line — three dials, each an offset from how it speaks alone. */
export function SpeechSection() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)

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
