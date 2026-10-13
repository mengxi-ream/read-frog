import type { To } from "react-router"
import { Link } from "react-router"
import { Button } from "@/components/ui/base-ui/button"
import { i18n } from "@/utils/i18n"

/**
 * Under a shortcut whose feature is switched off: the key is kept but does nothing for now. Marked
 * the way a feature still waiting for its provider is (`LlmFeatureStatusList`), with a button to
 * the switch that turns the feature back on.
 */
export function TurnedOffNote({ to }: { to: To }) {
  return (
    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="flex items-start gap-1.5">
        <span className="mt-[5px] size-2 shrink-0 rounded-full bg-warning" />
        {i18n.t("options.shortcuts.turnedOff")}
      </span>
      <Button variant="outline" size="xs" render={<Link to={to} />}>
        {i18n.t("options.shortcuts.turnOn")}
      </Button>
    </span>
  )
}
