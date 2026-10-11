import { Icon } from "@iconify/react"
import { useAtom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { patchSelectionToolbarAction } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { getSelectionToolbarItems } from "@/utils/selection-toolbar-items"
import { ConfigSection } from "../../components/config-section"
import { getActionShortcutId } from "./shortcut-bindings"
import { ShortcutConfigItem } from "./shortcut-config-item"
import { TurnedOffNote } from "./turned-off-note"

/**
 * A key for every AI action, built-in or the user's own, in the selection toolbar's order. A
 * new custom action has none until one is recorded here.
 */
export function ActionShortcuts() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const actions = getSelectionToolbarItems(selectionToolbar).flatMap((item) =>
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
          description={action.enabled === false ? <TurnedOffNote /> : undefined}
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
