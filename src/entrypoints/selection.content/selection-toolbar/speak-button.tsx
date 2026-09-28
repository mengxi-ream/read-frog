import { IconLoader2, IconPlayerStopFilled, IconVolume } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { useCallback } from "react"
import { toastManager } from "@/components/ui/base-ui/toast"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { SelectionToolbarTooltip, useSelectionTooltipState } from "../components/selection-tooltip"
import { selectionContentAtom } from "./atoms"

// Reads the selection aloud from the toolbar: its speak button, and the speak
// row of its "more" menu.
export function useSelectionSpeech() {
  const selectionContent = useAtomValue(selectionContentAtom)
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const { play, stop, isFetching, isPlaying } = useTextToSpeech(ANALYTICS_SURFACE.SELECTION_TOOLBAR)
  const isBusy = isFetching || isPlaying

  // Starts reading, or stops the reading in progress. False when nothing is
  // selected to read.
  const toggle = useCallback((): boolean => {
    if (isBusy) {
      stop()
      return true
    }

    if (!selectionContent) {
      toastManager.add({ type: "error", title: i18n.t("speak.noTextSelected") })
      return false
    }

    void play(selectionContent, ttsConfig)
    return true
  }, [isBusy, play, selectionContent, stop, ttsConfig])

  const label = isFetching
    ? i18n.t("speak.fetchingAudio")
    : isPlaying
      ? i18n.t("action.playing")
      : i18n.t("action.speak")

  return { isFetching, isPlaying, label, toggle }
}

export function SpeakButton() {
  const { isFetching, isPlaying, label: tooltipText, toggle } = useSelectionSpeech()
  const {
    handlePress,
    onOpenChange: handleTooltipOpenChange,
    open: tooltipOpen,
  } = useSelectionTooltipState()

  const handleClick = useCallback(() => {
    if (toggle()) {
      handlePress()
    }
  }, [handlePress, toggle])

  return (
    <SelectionToolbarTooltip
      content={tooltipText}
      open={tooltipOpen}
      onOpenChange={handleTooltipOpenChange}
      render={
        <button
          type="button"
          className="flex h-7 cursor-pointer items-center justify-center px-2 hover:bg-accent"
          onClick={handleClick}
          aria-label={tooltipText}
        />
      }
    >
      {isFetching ? (
        <IconLoader2 className="size-4.5 animate-spin" strokeWidth={1.6} />
      ) : isPlaying ? (
        <IconPlayerStopFilled className="size-4.5" strokeWidth={1.6} />
      ) : (
        <IconVolume className="size-4.5" strokeWidth={1.6} />
      )}
    </SelectionToolbarTooltip>
  )
}
