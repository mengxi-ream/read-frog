import { useAtomValue, useSetAtom } from "jotai"
import { use, useLayoutEffect, useState } from "react"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { CustomActionPanel } from "@/components/custom-action/custom-action-panel"
import { isSaveToNotebaseDialogOpenAtom } from "@/components/custom-action/save-to-notebase-dialog-atom"
import { SaveToNotebaseDialogHost } from "@/components/custom-action/save-to-notebase-dialog-host"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { closeWordLookupAtom, wordLookupAtom } from "./atoms"
import { useLookupPlayback } from "./use-lookup-playback"

function useCardLayer() {
  const shadowWrapper = use(ShadowWrapperContext)
  const [layer] = useState(() => {
    const element = document.createElement("div")
    element.style.position = "absolute"
    element.style.inset = "0"
    element.style.pointerEvents = "none"
    return element
  })

  useLayoutEffect(() => {
    const root = shadowWrapper?.getRootNode()
    if (!(root instanceof ShadowRoot)) {
      return undefined
    }
    root.appendChild(layer)
    return () => layer.remove()
  }, [layer, shadowWrapper])

  return layer
}

interface PinnedLayout {
  anchor: { x: number; y: number } | null
  sessionKey: number
}

export function WordLookupCard() {
  const lookup = useAtomValue(wordLookupAtom)
  const request = useAtomValue(customActionRequestAtom)
  const closeLookup = useSetAtom(closeWordLookupAtom)
  const isSaveToNotebaseDialogOpen = useAtomValue(isSaveToNotebaseDialogOpenAtom)
  const layer = useCardLayer()
  const open = lookup !== null
  const [pinnedLayout, setPinnedLayout] = useState<PinnedLayout | null>(null)
  if (!open && pinnedLayout) {
    setPinnedLayout(null)
  }

  useLookupPlayback()

  return (
    <ShadowWrapperContext value={layer}>
      <ThemeProvider container={layer}>
        <SelectionPopover.Root
          open={open}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              closeLookup()
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
            container={layer}
          >
            <CustomActionPanel />
          </SelectionPopover.Content>
        </SelectionPopover.Root>
        {(open || isSaveToNotebaseDialogOpen) && <SaveToNotebaseDialogHost />}
      </ThemeProvider>
    </ShadowWrapperContext>
  )
}
