import { i18n } from "#imports"
import { IconLoader2, IconPlayerStopFilled, IconVolume } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { useCallback } from "react"
import { buttonVariants } from "@/components/ui/base-ui/button"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { cn } from "@/utils/styles/utils"
import { SelectionPopoverTooltip, useSelectionTooltipState } from "../../components/selection-tooltip"

export function FieldSpeakButton({
  text,
  disabled,
}: {
  text: string
  disabled: boolean
}) {
  const { handlePress, onOpenChange: handleTooltipOpenChange, open: tooltipOpen } = useSelectionTooltipState()
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const { play, stop, isFetching, isPlaying } = useTextToSpeech(ANALYTICS_SURFACE.SELECTION_TOOLBAR)

  const handleClick = useCallback(() => {
    if (disabled) {
      return
    }

    if (isFetching || isPlaying) {
      handlePress()
      stop()
      return
    }

    handlePress()
    void play(text, ttsConfig)
  }, [disabled, handlePress, isFetching, isPlaying, play, stop, text, ttsConfig])

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
    <SelectionPopoverTooltip
      content={tooltipText}
      open={tooltipOpen}
      onOpenChange={handleTooltipOpenChange}
      render={(
        <button
          type="button"
          className={cn(buttonVariants({ variant: "ghost-secondary", size: "icon-xs" }), "text-muted-foreground")}
          onClick={handleClick}
          aria-label={tooltipText}
          disabled={disabled}
        />
      )}
    >
      {icon}
    </SelectionPopoverTooltip>
  )
}
