import type { SelectionToolbarInlineError } from "../selection-toolbar/inline-error"
import { IconAlertCircle } from "@tabler/icons-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/base-ui/alert"
import { Button } from "@/components/ui/base-ui/button"
import { sendMessage } from "@/utils/message"
import { cn } from "@/utils/styles/utils"

export function SelectionToolbarErrorAlert({
  className,
  error,
}: {
  className?: string
  error: SelectionToolbarInlineError | null
}) {
  if (!error) {
    return null
  }

  const { action } = error

  return (
    <div className={cn("px-4 pb-4", className)}>
      <Alert
        variant="destructive"
        // The action gets a grid column of its own rather than `AlertAction`,
        // which floats over a fixed 72px gutter: in a popover that shrinks to
        // 320px, a long localized title or label would slide underneath it.
        className={cn(action && "has-[>svg]:grid-cols-[auto_1fr_auto]")}
      >
        <IconAlertCircle className="size-4" />
        <AlertTitle>{error.title}</AlertTitle>
        <AlertDescription className="col-start-2">{error.description}</AlertDescription>
        {action && (
          <Button
            size="sm"
            variant="outline"
            className="col-start-3 row-span-2 row-start-1 self-center"
            // Content scripts cannot use chrome.tabs — route through the background.
            onClick={() => void sendMessage("openPage", { url: action.url, active: true })}
          >
            {action.label}
          </Button>
        )}
      </Alert>
    </div>
  )
}
