import { IconCheck, IconCopy } from "@tabler/icons-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

const COPIED_FEEDBACK_MS = 1500

/** Copies `text`, and says so for a moment once the clipboard has it. */
export function useCopyFeedback() {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const copy = (text: string) => {
    // No clipboard on a page served over plain HTTP: the id stays selectable instead.
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true)
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(setCopied, COPIED_FEEDBACK_MS, false)
      },
      () => {},
    )
  }

  return { copied, copy }
}

/** A button that copies a failed Built-in AI call's request id. */
export function CopyBuiltInAiRequestIdButton({
  requestId,
  className,
}: {
  requestId: string
  className?: string
}) {
  const { copied, copy } = useCopyFeedback()
  const label = i18n.t("hostedAi.requestId.copy")

  return (
    <Button
      type="button"
      variant="ghost-secondary"
      size="icon-xs"
      aria-label={label}
      title={copied ? i18n.t("action.copied") : label}
      onClick={() => copy(requestId)}
      className={className}
    >
      {copied ? <IconCheck className="text-success" /> : <IconCopy />}
    </Button>
  )
}

/**
 * The id that finds a failed Built-in AI call on the server, for the user to quote in a
 * report: shown whole, so that a screenshot carries it, with a button that copies it.
 */
export function BuiltInAiRequestId({
  requestId,
  className,
}: {
  requestId: string
  className?: string
}) {
  return (
    <div
      className={cn(
        // Not the surrounding text's break-anywhere: the id moves under the label rather
        // than break, and breaks only where no line is wide enough for it.
        "flex flex-wrap items-center gap-x-1 text-xs [word-break:normal] text-muted-foreground",
        className,
      )}
    >
      <span>{i18n.t("hostedAi.requestId.label")}</span>
      {/* About 260px at this size, to fit on one line in a toast's 284px. */}
      <span className="flex max-w-full items-center gap-0.5">
        <span className="min-w-0 font-mono text-[11px] break-words select-text">{requestId}</span>
        <CopyBuiltInAiRequestIdButton requestId={requestId} className="-my-1 -mr-1 shrink-0" />
      </span>
    </div>
  )
}

/** A toast's description of a failed Built-in AI call: what went wrong, then its id. */
export function BuiltInAiErrorToastDescription({
  message,
  requestId,
}: {
  message: string
  requestId: string
}) {
  return (
    <>
      {message}
      <BuiltInAiRequestId requestId={requestId} className="mt-1.5" />
    </>
  )
}
