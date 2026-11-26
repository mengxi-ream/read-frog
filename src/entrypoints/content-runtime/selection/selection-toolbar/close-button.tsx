import { IconX } from "@tabler/icons-react"
import { useAtom, useSetAtom } from "jotai"
import { useState } from "react"
import { addSitePattern, HideMenuItems } from "@/components/hide-menu-items"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { SELECTION_CONTENT_OVERLAY_LAYERS } from "@/utils/constants/selection-overlay-layers"
import { i18n } from "@/utils/i18n"
import { shadowWrapper } from "../main"
import { hideSelectionToolbarUntilReloadAtom } from "./atoms"

export const DropEvent = "rf-dropdown-change"

export function CloseButton() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const hideUntilReload = useSetAtom(hideSelectionToolbarUntilReloadAtom)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <DropdownMenu
      open={isDropdownOpen}
      onOpenChange={(open) => {
        setIsDropdownOpen(open)
        window.dispatchEvent(new CustomEvent(DropEvent, { detail: { open } }))
      }}
    >
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            title="Close selection toolbar"
            className={`absolute -top-1 -right-1 cursor-pointer rounded-full border border-border bg-neutral-100 dark:bg-neutral-900 ${isDropdownOpen ? "block" : "hidden group-hover:block"}`}
            onMouseDown={handleMouseDown}
          />
        }
      >
        <IconX className="h-3 w-3 text-neutral-400 dark:text-neutral-600" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        container={shadowWrapper}
        align="start"
        side="right"
        positionerClassName={SELECTION_CONTENT_OVERLAY_LAYERS.selectionOverlay}
        className="w-fit! max-w-72 min-w-48 whitespace-nowrap"
      >
        <HideMenuItems
          title={i18n.t("options.selectionToolbar.closeMenu.title")}
          settingsLocation={`${i18n.t("popup.options")} → ${i18n.t("options.selectionToolbar.title")}`}
          onHideUntilReload={hideUntilReload}
          onHideOnSite={(hostname) => {
            void setSelectionToolbar({
              ...selectionToolbar,
              disabledSelectionToolbarPatterns: addSitePattern(
                selectionToolbar.disabledSelectionToolbarPatterns ?? [],
                hostname,
              ),
            })
          }}
          onHideOnAllSites={() => {
            void setSelectionToolbar({ ...selectionToolbar, enabled: false })
          }}
          onItemMouseDown={handleMouseDown}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
