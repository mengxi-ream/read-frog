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

/**
 * The custom action card for a clicked subtitle word. It renders inside the
 * subtitles shadow root, which sits in the player, so it stays visible in
 * fullscreen where the selection toolbar's own card would not.
 */
export function WordLookupCard() {
  const lookup = useAtomValue(wordLookupAtom)
  const request = useAtomValue(customActionRequestAtom)
  const closeLookup = useSetAtom(closeWordLookupAtom)
  const isSaveToNotebaseDialogOpen = useAtomValue(isSaveToNotebaseDialogOpenAtom)
  const shadowWrapper = use(ShadowWrapperContext)
  const open = lookup !== null

  useLookupPlayback(open)

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
      {/* The dialog host asks for the auth session on mount; keep that off the
          page-load path and only pay for it once a lookup exists. */}
      {(open || isSaveToNotebaseDialogOpen) && <SaveToNotebaseDialogHost />}
    </ThemeProvider>
  )
}
