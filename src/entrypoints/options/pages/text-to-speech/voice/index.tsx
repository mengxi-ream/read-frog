import { useAtom, useAtomValue } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { GeminiVoiceItem } from "./gemini-voice-item"
import { LanguageVoiceItem } from "./language-voice-item"
import { TTSVoiceCombobox } from "./voice-combobox"

/** Which voice speaks: the one a language is read in, and the one it falls back to without a pick. */
export function VoiceSection() {
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)

  return (
    <ConfigSection id="voice" title={i18n.t("options.tts.voice.title")}>
      {ttsConfig.provider === "gemini" ? (
        // A Gemini voice reads every language, so there is no table to fill in.
        <GeminiVoiceItem />
      ) : (
        <>
          <LanguageVoiceItem />
          <FallbackVoiceItem />
        </>
      )}
    </ConfigSection>
  )
}

function FallbackVoiceItem() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)

  return (
    <ConfigItem
      id="tts-voice"
      title={i18n.t("options.tts.voice.fallback.title")}
      description={i18n.t("options.tts.voice.fallback.description")}
    >
      <TTSVoiceCombobox
        className="w-fit max-w-full"
        aria-label={i18n.t("options.tts.voice.fallback.title")}
        value={ttsConfig.defaultVoice}
        onValueChange={(voice) => {
          void setTtsConfig({ defaultVoice: voice })
        }}
      />
    </ConfigItem>
  )
}
