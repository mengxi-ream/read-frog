import type { TranslationState } from "@/types/translation-state"
import { atom } from "jotai"
import { translationStateSchema } from "@/types/translation-state"
import { createLogger } from "@/utils/logging/logger"
import { onMessage, sendMessage } from "../message"

const log = createLogger("atoms/translation-state")

export function createTranslationStateAtomForContentScript(defaultValue: TranslationState) {
  const baseAtom = atom<TranslationState>(defaultValue)

  baseAtom.onMount = (setAtom) => {
    // Load initial value
    sendMessage("getEnablePageTranslationFromContentScript", undefined)
      .then((enabled) => {
        const parsed = translationStateSchema.safeParse({ enabled })
        if (parsed.success) {
          setAtom(parsed.data)
        }
      })
      .catch((error) => {
        log.error("Error getting initial translation state", { error })
      })

    // Watch for changes
    return onMessage("notifyTranslationStateChanged", (msg) => {
      const parsed = translationStateSchema.safeParse(msg.data)
      if (parsed.success) {
        setAtom(parsed.data)
      }
    })
  }

  return baseAtom
}
