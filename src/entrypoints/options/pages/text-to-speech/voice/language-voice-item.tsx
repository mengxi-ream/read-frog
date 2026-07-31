import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { TTSVoice } from "@/types/config/tts"
import { IconLoader2, IconPlayerPlayFilled } from "@tabler/icons-react"
import { useAtom } from "jotai"
import { useState } from "react"
import { LanguageCombobox } from "@/components/language-combobox"
import { Button } from "@/components/ui/base-ui/button"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { getDefaultTTSVoiceForLanguage } from "@/types/config/tts"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { TTSVoiceCombobox } from "./voice-combobox"

/**
 * The voice one language is read in. Stacked, because choosing the language and choosing its
 * voice is a single move across two controls, and the pair is too wide to sit beside a label.
 */
export function LanguageVoiceItem() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)
  const [selectedLanguage, setSelectedLanguage] = useState<LangCodeISO6393>("eng")
  const { play, isFetching, isPlaying } = useTextToSpeech(ANALYTICS_SURFACE.TTS_SETTINGS)
  const isFetchingOrPlaying = isFetching || isPlaying

  const selectedLanguageVoice = ttsConfig.languageVoices[selectedLanguage] ?? ttsConfig.defaultVoice
  const defaultLanguageVoice = getDefaultTTSVoiceForLanguage(
    selectedLanguage,
    ttsConfig.defaultVoice,
  )

  const updateLanguageVoice = (voice: TTSVoice) => {
    void setTtsConfig({
      languageVoices: {
        ...ttsConfig.languageVoices,
        [selectedLanguage]: voice,
      },
    })
  }

  return (
    <ConfigItem
      id="language-voice"
      orientation="vertical"
      title={i18n.t("options.tts.voice.language.title")}
      description={i18n.t("options.tts.voice.language.description")}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {/* h-7 is what a sm box measures; the label keeps the 14px a select renders. */}
        <LanguageCombobox
          className="h-7 w-full sm:w-56"
          value={selectedLanguage}
          onValueChange={(value) => {
            if (value === "auto") {
              return
            }
            setSelectedLanguage(value)
          }}
        />

        <TTSVoiceCombobox
          className="min-w-0 sm:flex-1"
          aria-label={i18n.t("options.tts.voice.language.title")}
          value={selectedLanguageVoice}
          onValueChange={updateLanguageVoice}
        />

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={i18n.t("action.speak")}
            title={i18n.t("action.speak")}
            onClick={() => {
              void play(i18n.t("options.tts.voice.language.previewSample"), ttsConfig, {
                forcedVoice: selectedLanguageVoice,
              })
            }}
            disabled={isFetchingOrPlaying}
          >
            {isFetchingOrPlaying ? (
              <IconLoader2 className="animate-spin" />
            ) : (
              <IconPlayerPlayFilled />
            )}
          </Button>
          {/* A sm button shrinks its text too; hold it at 14px so the row reads as one size. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-sm"
            onClick={() => {
              updateLanguageVoice(defaultLanguageVoice)
            }}
            disabled={selectedLanguageVoice === defaultLanguageVoice}
          >
            {i18n.t("options.tts.voice.language.reset")}
          </Button>
        </div>
      </div>
    </ConfigItem>
  )
}
