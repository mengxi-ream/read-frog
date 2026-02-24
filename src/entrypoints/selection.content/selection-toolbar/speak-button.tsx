import { i18n } from "#imports"
import { IconLoader2, IconPlayerStopFilled, IconVolume } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { toast } from "sonner"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { selectionContentAtom } from "./atom"

export function SpeakButton() {
  const selectionContent = useAtomValue(selectionContentAtom)
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const { play, stop, isFetching, isPlaying } = useTextToSpeech()
  const isBusy = isFetching || isPlaying

  const handleClick = async () => {
    if (isBusy) {
      stop()
      return
    }

    if (!selectionContent) {
      toast.error(i18n.t("speak.noTextSelected"))
      return
    }

    void play(selectionContent, ttsConfig)
  }

  return (
    <button
      type="button"
      className="size-6 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer"
      onClick={handleClick}
      title={isFetching ? "Fetching audio… Click to stop" : isPlaying ? "Playing audio… Click to stop" : "Speak selected text"}
    >
      {isFetching
        ? (
            <IconLoader2 className="size-4 animate-spin" strokeWidth={1.6} />
          )
        : isPlaying
          ? (
              <IconPlayerStopFilled className="size-4" strokeWidth={1.6} />
            )
          : (
              <IconVolume className="size-4" strokeWidth={1.6} />
            )}
    </button>
  )
}
