import type { To } from "react-router"
import { Link } from "react-router"
import { Button } from "@/components/ui/base-ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { i18n } from "@/utils/i18n"

/**
 * Beside the title of a shortcut whose feature is switched off. The key is kept but does nothing
 * for now: the tooltip says so, and the button goes to the switch that turns the feature back on.
 * A size down from `xs`, so it fits the title's line without making the row taller.
 */
export function TurnOnButton({ to }: { to: To }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="xs"
            className="h-5 px-1.5 font-normal"
            render={<Link to={to} />}
          />
        }
      >
        <span className="size-1.5 shrink-0 rounded-full bg-warning" />
        {i18n.t("options.shortcuts.turnOn")}
      </TooltipTrigger>
      <TooltipContent>{i18n.t("options.shortcuts.turnedOff")}</TooltipContent>
    </Tooltip>
  )
}
