import type { SelectionPopoverPosition } from "@/components/ui/selection-popover"
import { useAtomValue, useSetAtom } from "jotai"
import { use, useState } from "react"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { CustomActionPanel } from "@/components/custom-action/custom-action-panel"
import { isSaveToNotebaseDialogOpenAtom } from "@/components/custom-action/save-to-notebase-dialog-atom"
import { SaveToNotebaseDialogHost } from "@/components/custom-action/save-to-notebase-dialog-host"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { SUBTITLES_BOX_CLASS } from "@/utils/constants/subtitles"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { subtitlesPositionAtom } from "../atoms"
import { lookUpAtom, wordLookupAtom } from "./atoms"
import { useHoldPlayback } from "./use-hold-playback"
import { useTopLayerPortalContainer } from "./use-top-layer-portal-container"

/**
 * Where the card opens, at the word's right edge and on the side of the
 * subtitles away from the edge of the video they sit at, so it never covers
 * them: above the subtitles at the bottom of the video, below the word at the top.
 */
function getWordAnchor(
  root: ParentNode,
  index: number,
  subtitlesAtBottom: boolean,
): SelectionPopoverPosition | null {
  const word = root.querySelector(`[data-slot="subtitle-word"][data-index="${index}"]`)
  if (!word) {
    return null
  }
  const rect = word.getBoundingClientRect()
  if (!subtitlesAtBottom) {
    return { x: rect.right, y: rect.bottom }
  }
  const boxTop = word.closest(`.${SUBTITLES_BOX_CLASS}`)?.getBoundingClientRect().top ?? rect.top
  return { x: rect.right, y: boxTop, above: true }
}

function isFromSubtitleWord(event: Event) {
  return event
    .composedPath()
    .some((node) => node instanceof Element && node.matches('[data-slot="subtitle-word"]'))
}

export function WordLookupCard() {
  const lookup = useAtomValue(wordLookupAtom)
  const request = useAtomValue(customActionRequestAtom)
  const lookUp = useSetAtom(lookUpAtom)
  const isSaveToNotebaseDialogOpen = useAtomValue(isSaveToNotebaseDialogOpenAtom)
  const subtitlesAtBottom = useAtomValue(subtitlesPositionAtom).anchor === "bottom"
  // The subtitles' own shadow root, read before this card provides its own container.
  const subtitlesRoot = use(ShadowWrapperContext)
  const [pinned, setPinned] = useState(false)
  // Owned here, so a lookup closed from outside the card (navigation, subtitles
  // turned off) also drops the pin.
  if (!lookup && pinned) {
    setPinned(false)
  }
  // Each new lookup places the card at its word and remounts it, unless the
  // card is pinned when the lookup arrives: then only its content changes, and
  // unpinning later leaves it where it is.
  const [placement, setPlacement] = useState<{
    seenSessionKey: number
    mountKey: number
    anchor: SelectionPopoverPosition | null
  }>({ seenSessionKey: 0, mountKey: 0, anchor: null })
  if (lookup && request && request.sessionKey !== placement.seenSessionKey) {
    setPlacement(
      pinned
        ? { ...placement, seenSessionKey: request.sessionKey }
        : {
            seenSessionKey: request.sessionKey,
            mountKey: request.sessionKey,
            anchor: getWordAnchor(subtitlesRoot ?? document, lookup.index, subtitlesAtBottom),
          },
    )
  }
  const open = lookup !== null
  const active = open || isSaveToNotebaseDialogOpen
  const container = useTopLayerPortalContainer(active)

  useHoldPlayback()

  return (
    <ShadowWrapperContext value={container}>
      <ThemeProvider container={container}>
        <SelectionPopover.Root
          open={open}
          anchor={placement.anchor}
          pinned={pinned}
          onPinnedChange={setPinned}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              lookUp(null)
            }
          }}
          onOpenChangeRequest={(_open, eventDetails) => {
            // A press on another subtitle word switches the card to it instead of closing it.
            if (eventDetails.reason === "outside-press" && isFromSubtitleWord(eventDetails.event)) {
              eventDetails.cancel()
            }
          }}
          disablePointerDismissal={isSaveToNotebaseDialogOpen}
        >
          <SelectionPopover.Content key={placement.mountKey} container={container}>
            <CustomActionPanel />
          </SelectionPopover.Content>
        </SelectionPopover.Root>
        {active && <SaveToNotebaseDialogHost />}
      </ThemeProvider>
    </ShadowWrapperContext>
  )
}
