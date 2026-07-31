import type { ColorPickerPopoverProps } from "@/components/ui/base-ui/color-picker"
import { useEffect, useRef, useState } from "react"
import { ColorPickerPopover } from "@/components/ui/base-ui/color-picker"

/**
 * Long enough to collapse a drag into one write, short enough that letting go of the
 * saturation square feels like it saved immediately.
 */
const COMMIT_DELAY_MS = 200

interface DebouncedColorPickerProps extends Omit<
  ColorPickerPopoverProps,
  "value" | "onValueChange"
> {
  value: string
  onCommit: (value: string) => void
}

/**
 * `ColorPickerPopover` wired for config-backed colours.
 *
 * The picker reports a new value on every pointer frame of a drag, and each one of ours
 * would become a `browser.storage` write on a serialized queue. So the panel and the trigger
 * swatch track the drag from local state while the write is debounced — the same split the
 * font sliders in these forms make with `onValueChange` / `onValueCommitted`.
 */
export function DebouncedColorPicker({ value, onCommit, ...props }: DebouncedColorPickerProps) {
  const [draft, setDraft] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Adopt outside changes — a reset button, another tab — but not while a write is pending,
  // which would otherwise snap the swatch back to the last saved colour mid-drag.
  useEffect(() => {
    if (timerRef.current === null) setDraft(value)
  }, [value])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <ColorPickerPopover
      {...props}
      value={draft}
      onValueChange={(next) => {
        setDraft(next)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          onCommit(next)
        }, COMMIT_DELAY_MS)
      }}
    />
  )
}
