import { useState } from "react"
import { Input } from "@/components/ui/base-ui/input"
import { toastManager } from "@/components/ui/base-ui/toast"
import { requestQueueConfigSchema } from "@/types/config/translate"
import { MAX_REQUEST_TIMEOUT_MS, MIN_REQUEST_TIMEOUT_MS } from "@/utils/constants/translate"

const timeoutMsSchema = requestQueueConfigSchema.shape.timeoutMs

/**
 * A queue's request timeout, typed in seconds and stored in milliseconds. Shared by the page
 * and subtitle queue pages.
 *
 * It saves on blur or Enter, not on every keystroke like the rate inputs beside it: with a
 * maximum, a keystroke save would keep the valid prefix of an over-limit number ("30" of
 * "300"), so the field would end on a value the user never chose. An invalid entry changes
 * nothing and goes back to the saved value.
 */
export function RequestTimeoutInput({
  timeoutMs,
  onTimeoutMsChange,
}: {
  timeoutMs: number
  onTimeoutMsChange: (timeoutMs: number) => void
}) {
  const savedSeconds = String(timeoutMs / 1000)
  const [inputValue, setInputValue] = useState(savedSeconds)
  const [prevTimeoutMs, setPrevTimeoutMs] = useState(timeoutMs)

  // Reset the draft input when the config value changes externally
  if (prevTimeoutMs !== timeoutMs) {
    setPrevTimeoutMs(timeoutMs)
    setInputValue(savedSeconds)
  }

  const commit = () => {
    // Whole milliseconds: 1.1 s × 1000 is 1100.0000000000002 in floating point. An empty
    // field is 0 here, which the minimum turns away.
    const newTimeoutMs = Math.round(Number(inputValue) * 1000)
    const parseResult = timeoutMsSchema.safeParse(newTimeoutMs)
    if (!parseResult.success) {
      toastManager.add({ type: "error", title: parseResult.error.issues[0]!.message })
      setInputValue(savedSeconds)
      return
    }
    if (newTimeoutMs !== timeoutMs) {
      // Persisting is enough: the background watches the stored config
      // and applies queue changes itself (no droppable message).
      onTimeoutMsChange(newTimeoutMs)
    }
  }

  return (
    <Input
      className="w-24 shrink-0"
      type="number"
      min={MIN_REQUEST_TIMEOUT_MS / 1000}
      max={MAX_REQUEST_TIMEOUT_MS / 1000}
      step="1"
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
      }}
    />
  )
}
