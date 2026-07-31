import type { ReactNode } from "react"
import { ShortcutKeyRecorder } from "@/components/shortcut-key-recorder"
import { ConfigItem } from "../../components/config-item"

/**
 * One recorded key combination, framed as a config item. The recorder is an `Input`, which
 * would otherwise stretch to whatever the control column happens to be — the fixed width
 * keeps every row on the page ending at the same edge.
 */
export function ShortcutConfigItem({
  id,
  title,
  description,
  shortcut,
  onChange,
}: {
  id: string
  title: ReactNode
  description: ReactNode
  shortcut: string
  onChange: (shortcut: string) => void
}) {
  return (
    <ConfigItem id={id} title={title} description={description}>
      <ShortcutKeyRecorder shortcutKey={shortcut} onChange={onChange} className="w-44" />
    </ConfigItem>
  )
}
