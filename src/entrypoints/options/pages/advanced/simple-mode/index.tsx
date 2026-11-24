import type { FeatureId } from "@/utils/features"
import { useAtomValue } from "jotai"
import { useLocation } from "react-router"
import { FeatureSwitch } from "@/components/feature-switch"
import { configAtom } from "@/utils/atoms/config"
import { getFeatureDescription, getFeatureTitle } from "@/utils/feature-text"
import { childrenOf, isFeatureOn, parentOf, TOP_LEVEL_FEATURES } from "@/utils/features"
import { i18n } from "@/utils/i18n"
import { getSimpleModeRowId } from "@/utils/navigation"
import { cn } from "@/utils/styles/utils"
import { getSectionIdFromSearch } from "../../../command-palette/section-scroll"
import { ConfigItem } from "../../../components/config-item"
import { PageLayout } from "../../../components/page-layout"

/**
 * Every simple mode switch, as the tree they form: a feature's switches sit under it, and under
 * a feature that is off they are greyed out and keep their values. The popup's drawer lists the
 * top level only.
 */
export function SimpleModePage() {
  return (
    <PageLayout
      title={i18n.t("options.simpleMode.title")}
      description={i18n.t("options.simpleMode.pageDescription")}
      innerClassName="flex flex-col gap-6"
    >
      {TOP_LEVEL_FEATURES.map((id) => (
        <FeatureRow key={id} id={id} />
      ))}
    </PageLayout>
  )
}

function FeatureRow({ id }: { id: FeatureId }) {
  const config = useAtomValue(configAtom)
  const { search } = useLocation()
  const rowId = getSimpleModeRowId(id)
  const parent = parentOf(id)
  const children = childrenOf(id)
  // Each row greys on its own, against its parent, so a row two levels under a feature that is
  // off is no fainter than the one above it.
  const underFeatureOff = parent !== undefined && !isFeatureOn(config, parent)
  // A row a link pointed at, like the one a page of a feature that is off sent the user to.
  const targeted = getSectionIdFromSearch(search) === rowId

  return (
    <div className="flex flex-col gap-5">
      <ConfigItem
        id={rowId}
        title={getFeatureTitle(id)}
        description={getFeatureDescription(id)}
        className={cn(
          "scroll-mt-8 rounded-sm transition-colors",
          underFeatureOff && "opacity-60",
          // An outline draws the highlight around the row without moving anything in it.
          targeted && "bg-accent/8 outline-8 outline-accent/8",
        )}
      >
        <FeatureSwitch id={id} aria-label={getFeatureTitle(id)} />
      </ConfigItem>
      {children.length > 0 && (
        <div className="ml-1 flex flex-col gap-5 border-l pl-5">
          {children.map((child) => (
            <FeatureRow key={child} id={child} />
          ))}
        </div>
      )}
    </div>
  )
}
