import type Glossary from "@/utils/db/dexie/tables/glossary"
import { Icon } from "@iconify/react"
import { Link } from "react-router"
import { Switch } from "@/components/ui/base-ui/switch"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { DRILL_IN_LOCATION_STATE } from "../../../navigation/drill-in"
import { useSetGlossaryEnabled } from "./use-glossary"

/**
 * One glossary in the list: opens its editor, and carries its on/off switch.
 *
 * Built as a stretched link rather than a `ConfigNavItem`, because the switch
 * cannot live inside the `<a>` — interactive content nested in a link is
 * invalid, and a click would both flip the switch and navigate. So the link is
 * an overlay covering the row and the switch sits above it.
 *
 * The three layers are ordered EXPLICITLY. `ConfigItem`'s own root is
 * `position: relative`, which makes it a positioned box in the same stacking
 * context as the overlay; left on `z-auto` both paint in DOM order and
 * `ConfigItem` — coming second — swallows every click except the sliver of row
 * padding above it.
 */
export function GlossaryListItem({
  glossary,
  termCount,
}: {
  glossary: Glossary
  termCount: number
}) {
  const { mutate: setEnabled } = useSetGlossaryEnabled()

  const name = glossary.name.trim() || i18n.t("options.advanced.glossary.untitled")
  // Composed from separate pieces rather than one sentence per case, because a
  // single `$1 terms · $2 websites` string cannot be made grammatical for a
  // count of one in English — and a 2x2 of whole sentences is four strings per
  // language to keep in sync.
  const termsLabel =
    termCount === 1
      ? i18n.t("options.advanced.glossary.summary.termsOne")
      : i18n.t("options.advanced.glossary.summary.terms", [String(termCount)])
  // Says which of the two scope states this glossary is in, so an empty site
  // list never has to be read as either "everywhere" or "nowhere".
  const sitesLabel =
    glossary.matchPatterns.length === 0
      ? i18n.t("options.advanced.glossary.summary.allSites")
      : glossary.matchPatterns.length === 1
        ? i18n.t("options.advanced.glossary.summary.sitesOne")
        : i18n.t("options.advanced.glossary.summary.sites", [String(glossary.matchPatterns.length)])
  const summary = `${termsLabel} · ${sitesLabel}`

  return (
    <div className="relative -mx-3 rounded-lg px-3 py-2 transition-colors focus-within:ring-3 focus-within:ring-ring/50 hover:bg-muted">
      <Link
        to={`/advanced/glossary/${glossary.id}`}
        state={DRILL_IN_LOCATION_STATE}
        className="absolute inset-0 z-10 rounded-lg outline-none"
      >
        <span className="sr-only">{name}</span>
      </Link>
      <ConfigItem title={name} description={summary}>
        {/* Above the link overlay, and swallowing its own events, so flipping
            the switch does not also open the glossary. */}
        <div className="relative z-20 flex items-center gap-3">
          <Switch
            checked={glossary.enabled}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onCheckedChange={(enabled) => setEnabled({ id: glossary.id, enabled })}
          />
          <Icon icon="tabler:chevron-right" className="size-4 text-muted-foreground" />
        </div>
      </ConfigItem>
    </div>
  )
}
