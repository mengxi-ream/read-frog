import type { NodeHotkey } from "@/utils/constants/hotkeys"
import { IconKeyboard, IconPointer } from "@tabler/icons-react"
import { HOTKEY_ICONS } from "@/utils/constants/hotkeys"
import { cn } from "@/utils/styles/utils"

// Drawn a size down and thinner than the default, to weigh what the key symbols beside them do.
const DRAWN_ICON_PROPS = { className: "size-3.5", stroke: 1.75 }

/**
 * The symbol of a hover translation hotkey, in a box one icon wide so the labels after it
 * line up. A single key shows its own symbol. A long press and a recorded combination are not one
 * key: they get a drawn icon, where an emoji would stand out in color and size.
 */
export function NodeHotkeyIcon({ hotkey, className }: { hotkey: NodeHotkey; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex w-4 shrink-0 items-center justify-center align-middle", className)}
    >
      {hotkey === "clickAndHold" ? (
        <IconPointer {...DRAWN_ICON_PROPS} />
      ) : hotkey === "custom" ? (
        <IconKeyboard {...DRAWN_ICON_PROPS} />
      ) : (
        HOTKEY_ICONS[hotkey]
      )}
    </span>
  )
}
