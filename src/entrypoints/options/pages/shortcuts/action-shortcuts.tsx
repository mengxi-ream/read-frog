import { Icon } from "@iconify/react"
import { useAtomValue, useSetAtom } from "jotai"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { patchSelectionToolbarAction } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { buildCustomActionOptionsRoute } from "@/utils/navigation"
import {
  getSelectionToolbarItems,
  SELECTION_TOOLBAR_ITEM_FEATURES,
} from "@/utils/selection-toolbar-items"
import { ConfigSection } from "../../components/config-section"
import { getActionShortcutId } from "./shortcut-bindings"
import { ShortcutConfigItem } from "./shortcut-config-item"

/**
 * A key for every AI action, built-in or the user's own, in the selection toolbar's order. A
 * new custom action has none until one is recorded here. A key works while its action's
 * toolbar item shows, so it has the item's features, and the action's own switch after them.
 */
export function ActionShortcuts() {
  const config = useAtomValue(configAtom)
  const setSelectionToolbar = useSetAtom(configFieldsAtomMap.selectionToolbar)
  const actions = getSelectionToolbarItems(config).flatMap((item) =>
    item.kind === "action" ? [item.action] : [],
  )

  return (
    <ConfigSection
      id="selection-action-shortcuts"
      title={i18n.t("options.shortcuts.actions.title")}
      className="mt-4"
    >
      <p className="-mt-2 text-[13px] leading-[18px] text-pretty text-muted-foreground">
        {i18n.t("options.shortcuts.actions.description")}
      </p>
      {actions.map((action) => (
        <ShortcutConfigItem
          key={action.id}
          id={getActionShortcutId(action.id)}
          title={
            <span className="flex items-center gap-2">
              <Icon icon={action.icon} className="size-4 shrink-0 text-muted-foreground" />
              {action.name}
            </span>
          }
          feature={SELECTION_TOOLBAR_ITEM_FEATURES.action}
          turnOn={action.enabled === false ? buildCustomActionOptionsRoute(action.id) : undefined}
          shortcut={action.shortcut ?? ""}
          onChange={(nextShortcut) => {
            void setSelectionToolbar((current) =>
              patchSelectionToolbarAction(current, action.id, { shortcut: nextShortcut }),
            )
          }}
        />
      ))}
    </ConfigSection>
  )
}
