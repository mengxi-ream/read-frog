import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { Button } from "@/components/ui/base-ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"

export function DiscordButton() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={(
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.open("https://discord.gg/ej45e3PezJ", "_blank", "noopener,noreferrer")}
          />
        )}
      >
        <Icon icon="logos:discord-icon" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[200px] text-wrap">
        {i18n.t("popup.discord.tooltip")}
      </TooltipContent>
    </Tooltip>
  )
}
