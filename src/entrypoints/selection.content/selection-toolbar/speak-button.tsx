import type { ReactNode } from "react"
import { IconLoader2, IconPlayerStopFilled, IconVolume } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { createContext, use, useCallback } from "react"
import { toastManager } from "@/components/ui/base-ui/toast"
import {
  SelectionToolbarTooltip,
  useSelectionTooltipState,
} from "@/components/ui/selection-popover/selection-tooltip"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { selectionContentAtom } from "./atoms"
import { ShortcutTooltipLabel } from "./shortcut-hint"
import { useSelectionShortcuts } from "./use-selection-shortcuts"

// Reads the selection aloud from the toolbar, or from its key.
function useSelectionSpeechController() {
  const selectionContent = useAtomValue(selectionContentAtom)
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const { speak } = useAtomValue(configFieldsAtomMap.selectionToolbar).features
  const { play, stop, isFetching, isPlaying } = useTextToSpeech(ANALYTICS_SURFACE.SELECTION_TOOLBAR)
  const isBusy = isFetching || isPlaying

  // The key toggles like the button, but with nothing to read it lets the
  // page have the keystroke rather than complain.
  useSelectionShortcuts({ speak: speak.enabled ? speak.shortcut : undefined }, () => {
    if (isBusy) {
      stop()
      return true
    }
    if (!selectionContent) {
      return false
    }
    void play(selectionContent, ttsConfig, { surface: ANALYTICS_SURFACE.SHORTCUT })
    return true
  })

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

type SelectionSpeech = ReturnType<typeof useSelectionSpeechController>

const SelectionSpeechContext = createContext<SelectionSpeech | null>(null)

// One reader for the whole toolbar: its speak button, the speak row of its
// "more" menu and the speak key show, and stop, the same playback, which
// outlives the button being unpinned and the toolbar being hidden.
export function SelectionSpeechProvider({ children }: { children: ReactNode }) {
  const speech = useSelectionSpeechController()
  return <SelectionSpeechContext value={speech}>{children}</SelectionSpeechContext>
}

export function useSelectionSpeech(): SelectionSpeech {
  const speech = use(SelectionSpeechContext)
  if (!speech) {
    throw new Error("Selection speech must be used within SelectionSpeechProvider.")
  }
  return speech
}

export function SpeakButton() {
  const { isFetching, isPlaying, label: tooltipText, toggle } = useSelectionSpeech()
  const { speak } = useAtomValue(configFieldsAtomMap.selectionToolbar).features
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
      content={<ShortcutTooltipLabel label={tooltipText} shortcut={speak.shortcut} />}
      open={tooltipOpen}
      onOpenChange={handleTooltipOpenChange}
      render={
        <button
          type="button"
          className="flex h-7 cursor-pointer items-center justify-center px-2 hover:bg-muted"
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
