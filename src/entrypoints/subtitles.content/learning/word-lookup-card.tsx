import { useAtomValue, useSetAtom } from "jotai"
import { use, useMemo, useState } from "react"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { CustomActionPanel } from "@/components/custom-action/custom-action-panel"
import { isSaveToNotebaseDialogOpenAtom } from "@/components/custom-action/save-to-notebase-dialog-atom"
import { SaveToNotebaseDialogHost } from "@/components/custom-action/save-to-notebase-dialog-host"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { lookUpAtom, wordLookupAtom } from "./atoms"
import { isFromSubtitleLine } from "./page-events"
import { useLookupPlayback } from "./use-lookup-playback"
import { useTopLayerPortalContainer } from "./use-top-layer-portal-container"

interface Point {
  x: number
  y: number
}

interface PinnedLayout {
  anchor: Point | null
  sessionKey: number
}

/** The bottom-right corner of a word on screen, where a subtitle selection opens its card. */
function getWordAnchor(root: ParentNode, index: number): Point | null {
  const word = root.querySelector(`[data-slot="subtitle-word"][data-index="${index}"]`)
  if (!word) {
    return null
  }
  const rect = word.getBoundingClientRect()
  return { x: rect.right, y: rect.bottom }
}

export function WordLookupCard() {
  const lookup = useAtomValue(wordLookupAtom)
  const request = useAtomValue(customActionRequestAtom)
  const lookUp = useSetAtom(lookUpAtom)
  // The subtitles' own shadow wrapper, read before this card provides its own.
  const subtitlesRoot = use(ShadowWrapperContext)
  const anchor = useMemo(
    () => (lookup ? getWordAnchor(subtitlesRoot ?? document, lookup.end) : null),
    [lookup, subtitlesRoot],
  )
  const isSaveToNotebaseDialogOpen = useAtomValue(isSaveToNotebaseDialogOpenAtom)
  const open = lookup !== null
  const cardOrDialogOpen = open || isSaveToNotebaseDialogOpen
  const container = useTopLayerPortalContainer(cardOrDialogOpen)
  const [pinnedLayout, setPinnedLayout] = useState<PinnedLayout | null>(null)
  if (!open && pinnedLayout) {
    setPinnedLayout(null)
  }

  useLookupPlayback()

  return (
    <ShadowWrapperContext value={container}>
      <ThemeProvider container={container}>
        <SelectionPopover.Root
          open={open}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              lookUp(null)
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
          anchor={pinnedLayout?.anchor ?? anchor}
          pinned={pinnedLayout !== null}
          onPinnedChange={(nextPinned) =>
            setPinnedLayout(nextPinned ? { anchor, sessionKey: request?.sessionKey ?? 0 } : null)
          }
          disablePointerDismissal={isSaveToNotebaseDialogOpen}
        >
          <SelectionPopover.Content
            key={pinnedLayout?.sessionKey ?? request?.sessionKey ?? 0}
            container={container}
          >
            <CustomActionPanel />
          </SelectionPopover.Content>
        </SelectionPopover.Root>
        {cardOrDialogOpen && <SaveToNotebaseDialogHost />}
      </ThemeProvider>
    </ShadowWrapperContext>
  )
}
