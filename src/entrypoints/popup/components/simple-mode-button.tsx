import { Icon } from "@iconify/react"
import { FeatureSwitch } from "@/components/feature-switch"
import { HelpTooltip } from "@/components/help-tooltip"
import { Button } from "@/components/ui/base-ui/button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/base-ui/drawer"
import { getFeatureDescription, getFeatureTitle } from "@/utils/feature-text"
import { TOP_LEVEL_FEATURES } from "@/utils/features"
import { i18n } from "@/utils/i18n"

/**
 * The browser sizes the popup window to its content, and the drawer is out of flow, so the
 * popup is held at this height while the drawer is open: enough for every switch.
 */
const DRAWER_MIN_HEIGHT = "440px"

function setPopupMinHeight(minHeight: string) {
  const root = document.getElementById("root")
  if (root) {
    root.style.minHeight = minHeight
  }
}

/**
 * Simple mode's top-level switches, a click away from the popup's header. The switches below
 * them (hover translation, the toolbar's buttons…) stay on their feature's options page.
 */
export function SimpleModeButton() {
  const title = i18n.t("options.simpleMode.title")

  return (
    <Drawer
      onOpenChange={(open) => {
        if (open) setPopupMinHeight(DRAWER_MIN_HEIGHT)
      }}
      onOpenChangeComplete={(open) => {
        // Only once the drawer is gone, so the window does not shrink under it as it slides out.
        if (!open) setPopupMinHeight("")
      }}
    >
      <DrawerTrigger render={<Button variant="outline" size="xs" />}>
        <Icon icon="tabler:leaf" />
        {title}
      </DrawerTrigger>
      {/* The default top margin and 80vh cap are for a tall window; the popup is not one. */}
      <DrawerContent className="data-[swipe-direction=down]:mt-4 data-[swipe-direction=down]:max-h-[calc(100vh-1rem)]">
        <DrawerHeader className="pt-3 pb-3">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription className="text-xs">
            {i18n.t("options.simpleMode.drawerDescription")}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="px-4 pb-4" data-base-ui-swipe-ignore="">
          <div className="flex flex-col gap-2.5">
            {TOP_LEVEL_FEATURES.map((id) => (
              <div key={id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[13px] font-medium">
                  {getFeatureTitle(id)}
                  <HelpTooltip>{getFeatureDescription(id)}</HelpTooltip>
                </span>
                <FeatureSwitch id={id} aria-label={getFeatureTitle(id)} />
              </div>
            ))}
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
