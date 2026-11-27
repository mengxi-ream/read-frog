import type { ReactNode } from "react"
import type { To } from "react-router"
import type { FeatureTag } from "@/utils/features"
import { useAtomValue } from "jotai"
import { ShortcutKeyRecorder } from "@/components/shortcut-key-recorder"
import { toastManager } from "@/components/ui/base-ui/toast"
import { configAtom } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { formatHotkey } from "@/utils/os"
import { ConfigItem } from "../../components/config-item"
import { buildTurnOnLink } from "../advanced/simple-mode/links"
import { useIsDifficultWordsOpen } from "../difficult-words/access"
import { findShortcutOwner, getShortcutBindings } from "./shortcut-bindings"
import { ShortcutTitle } from "./shortcut-title"

/**
 * One recorded key combination, framed as a config item. The recorder is an `Input`, which
 * would otherwise stretch to whatever the control column happens to be — the fixed width
 * keeps every row on the page ending at the same edge.
 *
 * Keys another shortcut already has are turned down, naming that shortcut. A clash saved
 * before this check existed is flagged under the description instead.
 *
 * Without a title, the row hangs off the previous item's, as `ConfigItem` does. `feature` is
 * what the key belongs to: while simple mode has it off, the title offers to turn it on (see
 * `ShortcutTitle`). `turnOn` is for a switch of the shortcut's own, which counts once the
 * feature is on.
 */
export function ShortcutConfigItem({
  id,
  title,
  description,
  shortcut,
  onChange,
  feature,
  turnOn,
}: {
  id: string
  title?: ReactNode
  description?: ReactNode
  shortcut: string
  onChange: (shortcut: string) => void
  feature?: FeatureTag
  turnOn?: To
}) {
  const config = useAtomValue(configAtom)
  const bindings = getShortcutBindings(config, { difficultWords: useIsDifficultWordsOpen() })
  const clash = findShortcutOwner(bindings, id, shortcut)

  return (
    <ConfigItem
      id={id}
      title={
        title && <ShortcutTitle title={title} turnOn={buildTurnOnLink(config, feature) ?? turnOn} />
      }
      description={
        clash ? (
          <>
            {description}
            <span className="mt-1 block text-destructive">
              {i18n.t("options.shortcuts.clash", [clash.title])}
            </span>
          </>
        ) : (
          description
        )
      }
    >
      <ShortcutKeyRecorder
        shortcutKey={shortcut}
        onChange={(nextShortcut) => {
          const owner = findShortcutOwner(bindings, id, nextShortcut)
          if (owner) {
            toastManager.add({
              type: "error",
              title: i18n.t("options.shortcuts.taken", [formatHotkey(nextShortcut), owner.title]),
            })
            return false
          }
          onChange(nextShortcut)
          return true
        }}
        className="w-44"
      />
    </ConfigItem>
  )
}
