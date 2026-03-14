import { i18n } from "#imports"
import { IconLoader2, IconPlayerStopFilled, IconVolume } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { useCallback, useState } from "react"
import { buttonVariants } from "@/components/ui/base-ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { useSelectionPopoverOverlayProps } from "@/components/ui/selection-popover"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { cn } from "@/utils/styles/utils"

const TOOLTIP_TRIGGER_PRESS_REASON = "trigger-press"

export function SpeakButton({ text }: { text: string | undefined }) {
  const popoverOverlay = useSelectionPopoverOverlayProps()
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const { play, stop, isFetching, isPlaying } = useTextToSpeech()

  const handleClick = useCallback(() => {
    if (isFetching || isPlaying) {
      setTooltipOpen(true)
      stop()
      return
    }
    if (!text)
      return
    setTooltipOpen(true)
    void play(text, ttsConfig)
  }, [isFetching, isPlaying, text, ttsConfig, play, stop])

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

  const icon = isFetching
    ? <IconLoader2 className="animate-spin" />
    : isPlaying
      ? <IconPlayerStopFilled />
      : <IconVolume />

  return (
    <Tooltip open={tooltipOpen} onOpenChange={handleTooltipOpenChange}>
      <TooltipTrigger
        render={(
          <button
            type="button"
            className={cn(buttonVariants({ variant: "ghost-secondary", size: "icon-sm" }))}
            onClick={handleClick}
          />
        )}
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent
        className="whitespace-nowrap"
        container={popoverOverlay.container}
        positionerClassName={popoverOverlay.positionerClassName}
      >
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  )
}
