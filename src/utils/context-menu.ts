import type { Config } from "@/types/config/config"
import { getSelectionToolbarActions } from "@/utils/custom-actions"
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
 * The items Read Frog adds to the right-click menu of a text selection, in
 * order: translate, read aloud, then every enabled action. The background
 * creates the menu from this list and the settings page previews it, so the
 * two can't drift apart.
 */
export function getSelectionContextMenuItems(
  selectionToolbar: Config["selectionToolbar"],
): SelectionContextMenuItem[] {
  return [
    { id: MENU_ID_SELECTION_TRANSLATE, title: i18n.t("contextMenu.translateSelection") },
    { id: MENU_ID_SELECTION_READ_ALOUD, title: i18n.t("contextMenu.readAloudSelection") },
    ...getSelectionToolbarActions(selectionToolbar)
      .filter((action) => action.enabled !== false)
      .map((action) => ({
        id: `${MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX}${action.id}`,
        title: action.name,
      })),
  ]
}
