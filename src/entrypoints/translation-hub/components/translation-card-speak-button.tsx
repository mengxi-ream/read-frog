import type { LangCodeISO6393 } from "@read-frog/definitions"
import { IconLoader2, IconPlayerStopFilled, IconVolume } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { useCallback } from "react"
import { i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { selectTTSVoice, useTextToSpeech } from "@/hooks/use-text-to-speech"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"

export function TranslationCardSpeakButton({ text, langCode }: { text: string, langCode: LangCodeISO6393 }) {
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const { play, stop, isFetching, isPlaying } = useTextToSpeech(ANALYTICS_SURFACE.TRANSLATION_HUB)
  const isBusy = isFetching || isPlaying

  const handleClick = useCallback(() => {
    if (isBusy) {
      stop()
      return
    }

    void play(text, ttsConfig, {
      forcedVoice: selectTTSVoice(ttsConfig, langCode),
    })
  }, [isBusy, langCode, play, stop, text, ttsConfig])

  const title = isFetching
    ? i18n.t("speak.fetchingAudio")
    : isPlaying
      ? i18n.t("action.playing")
      : i18n.t("action.speak")

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className="h-7 w-7"
      title={title}
      aria-label={title}
    >
      {isFetching
        ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
        : isPlaying
          ? <IconPlayerStopFilled className="h-3.5 w-3.5" />
          : <IconVolume className="h-3.5 w-3.5" />}
    </Button>
  )
}
