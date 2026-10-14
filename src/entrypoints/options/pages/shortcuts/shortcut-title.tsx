import type { ReactNode } from "react"
import type { To } from "react-router"
import { Link } from "react-router"
import { Button } from "@/components/ui/base-ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { i18n } from "@/utils/i18n"

/**
 * A shortcut row's title. While the feature the key belongs to is switched off, `turnOn` is where
 * its switch is, and a small "Turn on" button follows the title: hovering it says the key does
 * nothing for now, and clicking it goes to the switch. The button is a size down from `xs`, so it
 * fits the title's line without making the row taller.
 */
export function ShortcutTitle({ title, turnOn }: { title: ReactNode; turnOn?: To }) {
  if (!turnOn) return title

  return (
    <span className="flex items-center gap-2">
      {title}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="xs"
              className="h-5 px-1.5 font-normal"
              render={<Link to={turnOn} />}
            />
          }
        >
          <span className="size-1.5 shrink-0 rounded-full bg-warning" />
          {i18n.t("options.shortcuts.turnOn")}
        </TooltipTrigger>
        <TooltipContent>{i18n.t("options.shortcuts.turnedOff")}</TooltipContent>
      </Tooltip>
    </span>
  )
}
