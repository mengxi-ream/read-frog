import type { LanguageTag } from "@read-frog/definitions"
import { atom } from "jotai"
import { normalizeDetectedCode } from "@/utils/config/languages"
import { createLogger } from "@/utils/logging/logger"
import { DEFAULT_DETECTED_CODE } from "../constants/config"
import { onMessage, sendMessage } from "../message"

const log = createLogger("atoms/detected-code")

// Private base atom - not exported to prevent direct writes
const baseDetectedCodeAtom = atom<LanguageTag>(DEFAULT_DETECTED_CODE)

// Public atom with read/write - writes only update the in-memory popup state.
export const detectedCodeAtom = atom(
  (get) => get(baseDetectedCodeAtom),
  (_get, set, newValue: LanguageTag) => {
    set(baseDetectedCodeAtom, newValue)
  },
)

// onMount on base atom - gets triggered when derived atom subscribes
baseDetectedCodeAtom.onMount = (setAtom: (newValue: LanguageTag) => void) => {
  const refreshDetectedCode = () => {
    void sendMessage("getDetectedCode", undefined)
      .then((detectedCode) => setAtom(normalizeDetectedCode(detectedCode)))
      .catch((error) => {
        log.warn("Failed to refresh active tab detected language", { error })
        setAtom(DEFAULT_DETECTED_CODE)
      })
  }

  refreshDetectedCode()

  const cleanupDetectedCodeListener = onMessage("detectedPageLanguageChanged", (msg) => {
    setAtom(normalizeDetectedCode(msg.data.detectedCode))
  })

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      log.debug("detectedCodeAtom reloaded on visibility change")
      refreshDetectedCode()
    }
  }
  document.addEventListener("visibilitychange", handleVisibilityChange)

  return () => {
    cleanupDetectedCodeListener()
    document.removeEventListener("visibilitychange", handleVisibilityChange)
  }
}
