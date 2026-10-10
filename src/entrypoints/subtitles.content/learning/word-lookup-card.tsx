import { useAtomValue, useSetAtom } from "jotai"
import { use } from "react"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { CustomActionPanel } from "@/components/custom-action/custom-action-panel"
import { isSaveToNotebaseDialogOpenAtom } from "@/components/custom-action/save-to-notebase-dialog-atom"
import { SaveToNotebaseDialogHost } from "@/components/custom-action/save-to-notebase-dialog-host"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { SUBTITLES_THEME } from "@/utils/constants/subtitles"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { closeWordLookupAtom, wordLookupAtom } from "./atoms"
import { useLookupPlayback } from "./use-lookup-playback"
import { useLookupShortcuts } from "./use-lookup-shortcuts"
import { useWordSelectionDismiss } from "./use-word-selection-dismiss"

export function WordLookupCard() {
  const lookup = useAtomValue(wordLookupAtom)
  const request = useAtomValue(customActionRequestAtom)
  const closeLookup = useSetAtom(closeWordLookupAtom)
  const isSaveToNotebaseDialogOpen = useAtomValue(isSaveToNotebaseDialogOpenAtom)
  const shadowWrapper = use(ShadowWrapperContext)
  const open = lookup !== null

  useLookupPlayback()
  useLookupShortcuts()
  useWordSelectionDismiss()

  return (
    <ThemeProvider container={shadowWrapper ?? undefined} forcedTheme={SUBTITLES_THEME}>
      <SelectionPopover.Root
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeLookup()
          }
        }}
        anchor={lookup?.anchor ?? null}
        disablePointerDismissal={isSaveToNotebaseDialogOpen}
      >
        <SelectionPopover.Content
          key={request?.sessionKey ?? 0}
          container={shadowWrapper ?? document.body}
        >
          <CustomActionPanel />
        </SelectionPopover.Content>
      </SelectionPopover.Root>
      {(open || isSaveToNotebaseDialogOpen) && <SaveToNotebaseDialogHost />}
    </ThemeProvider>
  )
}
