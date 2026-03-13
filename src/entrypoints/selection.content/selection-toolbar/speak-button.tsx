import { i18n } from "#imports"
import { IconLoader2, IconPlayerStopFilled, IconVolume } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { useCallback, useState } from "react"
import { toast } from "sonner"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { SelectionToolbarTooltip } from "../components/selection-tooltip"
import { selectionContentAtom } from "./atoms"

const TOOLTIP_TRIGGER_PRESS_REASON = "trigger-press"

export function SpeakButton() {
  const selectionContent = useAtomValue(selectionContentAtom)
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const { play, stop, isFetching, isPlaying } = useTextToSpeech()
  const isBusy = isFetching || isPlaying
  const [tooltipOpen, setTooltipOpen] = useState(false)

  const handleClick = useCallback(async () => {
    if (isBusy) {
      setTooltipOpen(true)
      stop()
      return
    }

    if (!selectionContent) {
      toast.error(i18n.t("speak.noTextSelected"))
      return
    }

    setTooltipOpen(true)
    void play(selectionContent, ttsConfig)
  }, [isBusy, play, selectionContent, stop, ttsConfig])

  const handleTooltipOpenChange = useCallback((nextOpen: boolean, eventDetails: { reason: string }) => {
    if (!nextOpen && eventDetails.reason === TOOLTIP_TRIGGER_PRESS_REASON) {
      return
    }

    setTooltipOpen(nextOpen)
  }, [])

  const tooltipText = isFetching
    ? i18n.t("speak.fetchingAudio")
    : isPlaying
      ? i18n.t("action.playing")
      : i18n.t("action.speak")

  return (
    <SelectionToolbarTooltip
      content={tooltipText}
      open={tooltipOpen}
      onOpenChange={handleTooltipOpenChange}
      render={(
        <button
          type="button"
          className="px-2 h-7 flex items-center justify-center hover:bg-accent cursor-pointer"
          onClick={handleClick}
          aria-label={tooltipText}
        />
      )}
    >
      {isFetching
        ? (
            <IconLoader2 className="size-4.5 animate-spin" strokeWidth={1.6} />
          )
        : isPlaying
          ? (
              <IconPlayerStopFilled className="size-4.5" strokeWidth={1.6} />
            )
          : (
              <IconVolume className="size-4.5" strokeWidth={1.6} />
            )}
    </SelectionToolbarTooltip>
  )
}
