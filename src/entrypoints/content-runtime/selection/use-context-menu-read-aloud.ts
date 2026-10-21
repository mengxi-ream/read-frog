import { useAtomValue } from "jotai"
import { useEffect, useEffectEvent } from "react"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { onMessage } from "@/utils/message"
import { readSelectionSnapshot } from "./utils"

export function useContextMenuReadAloud() {
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const { play } = useTextToSpeech(ANALYTICS_SURFACE.CONTEXT_MENU)

  // The menu was opened on this frame's selection, so read it the way the
  // toolbar does: the menu's own text keeps furigana next to its base text.
  const handleReadAloud = useEffectEvent((selectionText: string) => {
    const text = readSelectionSnapshot(window.getSelection())?.text || selectionText
    void play(text, ttsConfig)
  })

  useEffect(() => {
    return onMessage("readAloudSelectionFromContextMenu", (message) => {
      handleReadAloud(message.data.selectionText)
    })
  }, [])
}
