import { useAtomValue, useSetAtom } from "jotai"
import { useState } from "react"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { CustomActionPanel } from "@/components/custom-action/custom-action-panel"
import { isSaveToNotebaseDialogOpenAtom } from "@/components/custom-action/save-to-notebase-dialog-atom"
import { SaveToNotebaseDialogHost } from "@/components/custom-action/save-to-notebase-dialog-host"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { closeWordLookupAtom, wordLookupAtom } from "./atoms"
import { isFromSubtitleLine } from "./page-events"
import { useLookupPlayback } from "./use-lookup-playback"
import { useLookupShortcuts } from "./use-lookup-shortcuts"
import { useTopLayerPortalContainer } from "./use-top-layer-portal-container"

interface PinnedLayout {
  anchor: { x: number; y: number } | null
  sessionKey: number
}

export function WordLookupCard() {
  const lookup = useAtomValue(wordLookupAtom)
  const request = useAtomValue(customActionRequestAtom)
  const closeLookup = useSetAtom(closeWordLookupAtom)
  const isSaveToNotebaseDialogOpen = useAtomValue(isSaveToNotebaseDialogOpenAtom)
  const open = lookup !== null
  const cardOrDialogOpen = open || isSaveToNotebaseDialogOpen
  const container = useTopLayerPortalContainer(cardOrDialogOpen)
  const [pinnedLayout, setPinnedLayout] = useState<PinnedLayout | null>(null)
  if (!open && pinnedLayout) {
    setPinnedLayout(null)
  }

  useLookupPlayback()
  useLookupShortcuts()

  return (
    <ShadowWrapperContext value={container}>
      <ThemeProvider container={container}>
        <SelectionPopover.Root
          open={open}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              closeLookup()
            }
          }}
          onOpenChangeRequest={(nextOpen, eventDetails) => {
            if (
              !nextOpen &&
              eventDetails.reason === "outside-press" &&
              isFromSubtitleLine(eventDetails.event)
            ) {
              eventDetails.cancel()
            }
          }}
          anchor={pinnedLayout?.anchor ?? lookup?.anchor ?? null}
          pinned={pinnedLayout !== null}
          onPinnedChange={(nextPinned) =>
            setPinnedLayout(
              nextPinned
                ? { anchor: lookup?.anchor ?? null, sessionKey: request?.sessionKey ?? 0 }
                : null,
            )
          }
          disablePointerDismissal={isSaveToNotebaseDialogOpen}
        >
          <SelectionPopover.Content
            key={pinnedLayout?.sessionKey ?? request?.sessionKey ?? 0}
            container={container}
            anchorPoint="bottom-center"
          >
            <CustomActionPanel />
          </SelectionPopover.Content>
        </SelectionPopover.Root>
        {cardOrDialogOpen && <SaveToNotebaseDialogHost />}
      </ThemeProvider>
    </ShadowWrapperContext>
  )
}
