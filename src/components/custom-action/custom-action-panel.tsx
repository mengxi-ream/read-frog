import { useRef } from "react"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { ReviewDueTab } from "@/components/ui/selection-popover/review-due-tab"
import { SelectionToolbarErrorAlert } from "@/components/ui/selection-popover/selection-toolbar-error-alert"
import { CustomActionContent } from "./custom-action-content"
import { CustomActionPanelFooter } from "./custom-action-panel-footer"
import { CustomActionPanelHeader } from "./custom-action-panel-header"
import { useCustomActionRun } from "./use-custom-action-run"

export function CustomActionPanel() {
  const bodyRef = useRef<HTMLDivElement>(null)
  const run = useCustomActionRun(bodyRef)
  const { request } = run

  if (!request) {
    return null
  }

  return (
    <>
      <CustomActionPanelHeader action={run.action} />
      <SelectionPopover.Body key={`${request.sessionKey}:${request.selectionText}`} ref={bodyRef}>
        <CustomActionContent
          action={run.action}
          status={run.layout.status}
          selection={run.layout.selection}
          targetCode={run.layout.targetCode}
          selectionContent={request.selectionText}
          value={run.result}
          thinking={run.thinking}
          speakSurface={request.surface}
        />
        <SelectionToolbarErrorAlert error={run.error} />
      </SelectionPopover.Body>
      <ReviewDueTab source="extension_custom_ai_action" />
      <CustomActionPanelFooter run={run} />
    </>
  )
}
