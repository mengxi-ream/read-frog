import { IconAppWindow, IconEyeOff, IconRefresh, IconWorld } from "@tabler/icons-react"
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/base-ui/dropdown-menu"
import { i18n } from "@/utils/i18n"
import { sitePatternForHost } from "@/utils/url-pattern"

// Stands in for the settings location, so the sentence around it can be split
// off and the location rendered as one unbreakable piece.
const LOCATION_SLOT = "\uE000"

interface HideMenuItemsProps {
  /** Names what gets hidden, so the choices below only have to name a scope. */
  title: string
  /** Where it is turned back on, e.g. "Options → Floating Button". */
  settingsLocation: string
  onHideUntilReload: () => void
  onHideOnSite: (hostname: string) => void
  onHideOnAllSites: () => void
  onItemMouseDown?: (event: React.MouseEvent) => void
}

/**
 * The menu behind the × on the floating button and on the selection toolbar.
 *
 * Choices go from the smallest scope to the largest. The first changes no
 * setting, so the × can simply close the control. The other two save the same
 * settings the menu always did, and the note under them says where to undo
 * that: once they apply, the control that opened this menu is gone.
 */
export function HideMenuItems({
  title,
  settingsLocation,
  onHideUntilReload,
  onHideOnSite,
  onHideOnAllSites,
  onItemMouseDown,
}: HideMenuItemsProps) {
  // Empty for local files: there is no site to name, so that choice is left out.
  const hostname = window.location.hostname
  const [hintBefore, hintAfter = ""] = i18n
    .t("hideMenu.restoreHint", [LOCATION_SLOT])
    .split(LOCATION_SLOT)

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel className="flex items-center gap-1.5">
          <IconEyeOff className="size-3.5 shrink-0" />
          {title}
        </DropdownMenuLabel>
        <DropdownMenuItem onMouseDown={onItemMouseDown} onClick={onHideUntilReload}>
          <IconRefresh className="text-muted-foreground" />
          {i18n.t("hideMenu.untilReload")}
        </DropdownMenuItem>
        {hostname && (
          <DropdownMenuItem
            title={hostname}
            onMouseDown={onItemMouseDown}
            onClick={() => onHideOnSite(hostname)}
          >
            <IconAppWindow className="text-muted-foreground" />
            <span className="min-w-0 truncate">{i18n.t("hideMenu.onSite", [hostname])}</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onMouseDown={onItemMouseDown} onClick={onHideOnAllSites}>
          <IconWorld className="text-muted-foreground" />
          {i18n.t("hideMenu.onAllSites")}
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      {/* Zero width with a full minimum: the note wraps to the width the choices
          set, instead of stretching the menu to its own length. Lines may break
          around the location but never inside it ("悬浮/按钮"), and balance keeps
          a CJK break from stranding one character. */}
      <p className="w-0 min-w-full px-1.5 py-1 text-xs text-balance whitespace-normal text-muted-foreground">
        {hintBefore}
        <span className="whitespace-nowrap">{settingsLocation}</span>
        {hintAfter}
      </p>
    </>
  )
}

/**
 * Adds a site to an opt-out list in the form the popup's per-site switches
 * store: the user pointed at a page, so "this site" covers what lives under it.
 */
export function addSitePattern(patterns: readonly string[], hostname: string): string[] {
  const pattern = sitePatternForHost(hostname)
  return patterns.includes(pattern) ? [...patterns] : [...patterns, pattern]
}
