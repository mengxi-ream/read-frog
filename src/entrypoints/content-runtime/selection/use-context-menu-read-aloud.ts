import { useAtomValue } from "jotai"
import { useEffect, useEffectEvent } from "react"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { onMessage } from "@/utils/message"
import { readSelectionSnapshot, toComparableSelectionText } from "./utils"

/**
 * The menu's text is the selection it was opened on. This frame's selection is
 * read the way the toolbar reads it, since the menu's text keeps furigana next
 * to its base text, but only while it is still that selection: the browser's
 * text for it must be the menu's. A selection made or changed since the menu
 * opened is another one.
 */
function readMenuSelectionText(menuText: string) {
  const selection = window.getSelection()
  if (
    !selection ||
    toComparableSelectionText(selection.toString()) !== toComparableSelectionText(menuText)
  ) {
    return menuText
  }

  return readSelectionSnapshot(selection)?.text || menuText
}

export function useContextMenuReadAloud() {
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const { play } = useTextToSpeech(ANALYTICS_SURFACE.CONTEXT_MENU)

  // A menu opened in a book section of the ebook reader was opened on that
  // frame's selection: whatever is selected in this frame is something else.
  const handleReadAloud = useEffectEvent((selectionText: string, fromEbookSection?: boolean) => {
    const text = fromEbookSection ? selectionText : readMenuSelectionText(selectionText)
    void play(text, ttsConfig).catch(() => {})
  })

  useEffect(() => {
    return onMessage("readAloudSelectionFromContextMenu", (message) => {
      handleReadAloud(message.data.selectionText, message.data.fromEbookSection)
    })
  }, [])
}
