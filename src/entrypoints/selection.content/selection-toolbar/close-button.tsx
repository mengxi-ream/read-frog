import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useAtom } from "jotai"
import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { shadowWrapper } from ".."

export const DropEvent = "rf-dropdown-change"

export function CloseButton() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
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
        render={(
          <button
            type="button"
            title="Close selection toolbar"
            className={`border-border absolute -top-1 -right-1 cursor-pointer rounded-full border bg-neutral-100 dark:bg-neutral-900 ${isDropdownOpen ? "block" : "hidden group-hover:block"}`}
            onMouseDown={handleMouseDown}
          />
        )}
      >
        <Icon icon="tabler:x" className="h-3 w-3 text-neutral-400 dark:text-neutral-600" />
      </DropdownMenuTrigger>
      <DropdownMenuContent container={shadowWrapper} align="start" side="right" className="z-2147483647 w-fit! whitespace-nowrap">
        <DropdownMenuItem
          onMouseDown={handleMouseDown}
          onClick={() => {
            const currentDomain = window.location.hostname
            const currentPatterns = selectionToolbar.disabledSelectionToolbarPatterns || []
            void setSelectionToolbar({
              ...selectionToolbar,
              disabledSelectionToolbarPatterns: [...currentPatterns, currentDomain],
            })
          }}
        >
          {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.closeMenu.disableForSite")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onMouseDown={handleMouseDown}
          onClick={() => {
            void setSelectionToolbar({ ...selectionToolbar, enabled: false })
          }}
        >
          {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.closeMenu.disableGlobally")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
