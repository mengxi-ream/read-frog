import { useAtomValue } from "jotai"
import { useEffect, useRef } from "react"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { onMessage } from "@/utils/message"

export function useContextMenuReadAloud() {
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const { play } = useTextToSpeech(ANALYTICS_SURFACE.CONTEXT_MENU)

  const callbackRef = useRef({ play, ttsConfig })
  callbackRef.current = { play, ttsConfig }

  useEffect(() => {
    return onMessage("readAloudSelectionFromContextMenu", (message) => {
      void callbackRef.current.play(message.data.selectionText, callbackRef.current.ttsConfig)
    })
  }, [])
}
