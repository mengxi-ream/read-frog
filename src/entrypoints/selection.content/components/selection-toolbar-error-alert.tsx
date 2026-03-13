import type { SelectionToolbarInlineError } from "../selection-toolbar/inline-error"
import { IconAlertCircle } from "@tabler/icons-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/base-ui/alert"
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

  return (
    <div className={cn("px-4 pb-4", className)}>
      <Alert variant="destructive">
        <IconAlertCircle className="size-4" />
        <AlertTitle>{error.title}</AlertTitle>
        <AlertDescription>
          {error.description}
        </AlertDescription>
      </Alert>
    </div>
  )
}
