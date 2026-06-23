import { useAtomValue } from "jotai"
import { useEffect, useEffectEvent } from "react"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { onMessage } from "@/utils/message"

export function useContextMenuReadAloud() {
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const { play } = useTextToSpeech(ANALYTICS_SURFACE.CONTEXT_MENU)

  const handleReadAloud = useEffectEvent((selectionText: string) => {
    void play(selectionText, ttsConfig)
  })

  useEffect(() => {
    return onMessage("readAloudSelectionFromContextMenu", (message) => {
      handleReadAloud(message.data.selectionText)
    })
  }, [])
}
