import type { SaveToNotebaseOutcome } from "@/components/custom-action/use-save-to-notebase"
import type { SelectionPopoverPosition } from "@/components/ui/selection-popover"
import { IconCheck } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { use } from "react"
import { CustomActionPanel } from "@/components/custom-action/custom-action-panel"
import { isSaveToNotebaseDialogOpenAtom } from "@/components/custom-action/save-to-notebase-dialog-atom"
import { Button } from "@/components/ui/base-ui/button"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { ReviewDueTab } from "@/components/ui/selection-popover/review-due-tab"
import { SELECTION_TOOLBAR_FOOTER_COMPACT_CLASSES } from "@/components/ui/selection-popover/selection-toolbar-footer-compact"
import { i18n } from "@/utils/i18n"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { cn } from "@/utils/styles/utils"
import { difficultWordRequestAtom } from "./atoms"

/**
 * The card of a clicked difficult word: the lookup action's card, with
 * "I know it" where the selection toolbar's card has its provider picker.
 * The toolbar's Notebase dialog host serves its save button.
 */
export function DifficultWordCard({
  open,
  anchor,
  mountKey,
  onClose,
  onKnown,
  onSave,
  isOverMark,
}: {
  open: boolean
  anchor: SelectionPopoverPosition | null
  /** A new word remounts the card at its place. */
  mountKey: number
  onClose: () => void
  onKnown: () => void
  onSave: (outcome: SaveToNotebaseOutcome) => void
  /** Whether a press was on a marked word: it opens that word's card instead of closing this one. */
  isOverMark: (event: Event) => boolean
}) {
  const container = use(ShadowWrapperContext)
  const isSaveToNotebaseDialogOpen = useAtomValue(isSaveToNotebaseDialogOpenAtom)

  return (
    <SelectionPopover.Root
      open={open}
      anchor={anchor}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
      onOpenChangeRequest={(_open, eventDetails) => {
        if (eventDetails.reason === "outside-press" && isOverMark(eventDetails.event)) {
          eventDetails.cancel()
        }
      }}
      disablePointerDismissal={isSaveToNotebaseDialogOpen}
    >
      <SelectionPopover.Content key={mountKey} container={container ?? document.body}>
        <CustomActionPanel.Root requestAtom={difficultWordRequestAtom}>
          <CustomActionPanel.Header />
          <CustomActionPanel.Body />
          <ReviewDueTab source="extension_difficult_words" />
          <CustomActionPanel.Footer onSave={onSave}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("min-w-0", SELECTION_TOOLBAR_FOOTER_COMPACT_CLASSES.button)}
              title={i18n.t("difficultWords.knownDescription")}
              onClick={onKnown}
            >
              <IconCheck />
              <span className={cn("truncate", SELECTION_TOOLBAR_FOOTER_COMPACT_CLASSES.label)}>
                {i18n.t("difficultWords.known")}
              </span>
            </Button>
          </CustomActionPanel.Footer>
        </CustomActionPanel.Root>
      </SelectionPopover.Content>
    </SelectionPopover.Root>
  )
}
