import { Icon } from "@iconify/react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { Button } from "@/components/ui/base-ui/button"
import { Textarea } from "@/components/ui/base-ui/textarea"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import {
  inputTextAtom,
  sourceLangCodeAtom,
  targetLangCodeAtom,
  translateRequestAtom,
} from "../atoms"

export function TextInput() {
  const [value, setValue] = useAtom(inputTextAtom)
  const sourceLangCode = useAtomValue(sourceLangCodeAtom)
  const targetLangCode = useAtomValue(targetLangCodeAtom)
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const setTranslateRequest = useSetAtom(translateRequestAtom)
  const { play, stop, isFetching, isPlaying } = useTextToSpeech(ANALYTICS_SURFACE.TRANSLATION_HUB)

  const speechAction = isFetching
    ? "speak.fetchingAudio"
    : isPlaying
      ? "action.playing"
      : "translationHub.speakSourceText"

  const handleSpeak = () => {
    if (isFetching || isPlaying) {
      stop()
    } else if (value.trim()) {
      void play(value, ttsConfig)
    }
  }

  const handleTranslate = () => {
    if (!value.trim()) return
    setTranslateRequest({
      inputText: value,
      sourceLanguage: sourceLangCode,
      targetLanguage: targetLangCode,
      timestamp: Date.now(),
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleTranslate()
    }
  }

  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={i18n.t("translationHub.inputPlaceholder")}
        className="h-96 min-h-0 resize-none px-4 pt-3 pb-12 text-lg!"
        style={{ userSelect: "text" }}
      />

      <div className="absolute right-3 bottom-3 flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleSpeak}
          disabled={!value.trim() && !isFetching && !isPlaying}
          title={i18n.t(speechAction)}
          aria-label={i18n.t(speechAction)}
        >
          <Icon
            icon={
              isFetching
                ? "tabler:loader-2"
                : isPlaying
                  ? "tabler:player-stop-filled"
                  : "tabler:volume"
            }
            className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
          />
        </Button>
        <Button onClick={handleTranslate} disabled={!value.trim()} size="sm">
          {i18n.t("translationHub.translate")}
          <span className="ml-1.5 text-xs">⌘↵</span>
        </Button>
      </div>
    </div>
  )
}
