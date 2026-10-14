import type { CustomActionRun } from "./use-custom-action-run"
import { useHostedAiProviderOptions } from "@/components/llm-providers/use-hosted-ai-provider-options"
import { SelectionToolbarFooterContent } from "@/components/ui/selection-popover/selection-toolbar-footer-content"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { CustomActionToolButton } from "./custom-action-tool-button"
import { SaveToNotebaseButton } from "./save-to-notebase-button"

/**
 * Keeps the hosted-status hook inside SelectionPopover.Content, which stays
 * unmounted until the popover first opens — the selection app mounts on every
 * page, and merely loading a page must not fire hosted-AI session/status
 * requests.
 */
export function CustomActionPanelFooter({ run }: { run: CustomActionRun }) {
  const providers = useHostedAiProviderOptions("customAction", run.providers)
  const { action } = run
  const saveSurface =
    run.request?.surface === ANALYTICS_SURFACE.VIDEO_SUBTITLES
      ? ANALYTICS_SURFACE.VIDEO_SUBTITLES
      : ANALYTICS_SURFACE.SELECTION_TOOLBAR

  return (
    <SelectionToolbarFooterContent
      paragraphsText={run.request?.contextText ?? ""}
      providers={providers}
      titleText={run.titleText}
      value={run.provider?.id ?? ""}
      onProviderChange={run.changeProvider}
      onRegenerate={run.regenerate}
    >
      {action && (
        <>
          <SaveToNotebaseButton
            action={action}
            isRunning={run.isRunning}
            result={run.result}
            surface={saveSurface}
          />
          <CustomActionToolButton action={action} />
        </>
      )}
    </SelectionToolbarFooterContent>
  )
}
