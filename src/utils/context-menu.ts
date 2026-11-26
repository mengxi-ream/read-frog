import type { Config } from "@/types/config/config"
import type { FeatureTag } from "@/utils/features"
import { getSelectionToolbarActions } from "@/utils/custom-actions"
import { isShown } from "@/utils/features"
import { i18n } from "@/utils/i18n"

export const MENU_ID_TRANSLATE = "read-frog-translate"
export const MENU_ID_SELECTION_TRANSLATE = "read-frog-selection-translate"
export const MENU_ID_SELECTION_READ_ALOUD = "read-frog-selection-read-aloud"
export const MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX = "read-frog-selection-custom-action:"

export interface SelectionContextMenuItem {
  id: string
  /** `%s` stands for the selected text; the browser fills it in. */
  title: string
}

/**
 * What the page item, "Translate", needs on in simple mode: the context menu, and page
 * translation, which it toggles.
 */
export const PAGE_CONTEXT_MENU_ITEM_FEATURES = [
  "contextMenu",
  "pageTranslation",
] as const satisfies FeatureTag

/**
 * The items Read Frog adds to the right-click menu of a text selection, in
 * order: translate, read aloud, then every enabled action. The background
 * creates the menu from this list and the settings page previews it, so the
 * two can't drift apart. The actions go while simple mode has custom AI
 * actions off; translate and read aloud answer to the context menu's own
 * switch only, not to the toolbar buttons of the same name.
 */
export function getSelectionContextMenuItems(config: Config): SelectionContextMenuItem[] {
  const items: (SelectionContextMenuItem & { feature?: FeatureTag })[] = [
    { id: MENU_ID_SELECTION_TRANSLATE, title: i18n.t("contextMenu.translateSelection") },
    { id: MENU_ID_SELECTION_READ_ALOUD, title: i18n.t("contextMenu.readAloudSelection") },
    ...getSelectionToolbarActions(config.selectionToolbar)
      .filter((action) => action.enabled !== false)
      .map((action) => ({
        id: `${MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX}${action.id}`,
        title: action.name,
        feature: "customActions" as const,
      })),
  ]
  return items
    .filter((item) => isShown(config, item.feature))
    .map(({ id, title }) => ({ id, title }))
}
