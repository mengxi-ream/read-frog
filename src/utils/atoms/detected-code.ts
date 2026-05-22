import type { LangCodeISO6393 } from "@read-frog/definitions"
import { atom } from "jotai"
import { normalizeDetectedCode } from "@/utils/config/languages"
import { DEFAULT_DETECTED_CODE } from "../constants/config"
import { logger } from "../logger"
import { onMessage, sendMessage } from "../message"

// Private base atom - not exported to prevent direct writes
const baseDetectedCodeAtom = atom<LangCodeISO6393>(DEFAULT_DETECTED_CODE)

// Public atom with read/write - writes only update the in-memory popup state.
export const detectedCodeAtom = atom(
  get => get(baseDetectedCodeAtom),
  (_get, set, newValue: LangCodeISO6393) => {
    set(baseDetectedCodeAtom, newValue)
  },
)

// onMount on base atom - gets triggered when derived atom subscribes
baseDetectedCodeAtom.onMount = (setAtom: (newValue: LangCodeISO6393) => void) => {
  const refreshDetectedCode = () => {
    void sendMessage("getDetectedCode", undefined)
      .then(detectedCode => setAtom(normalizeDetectedCode(detectedCode)))
      .catch((error) => {
        logger.warn("Failed to refresh active tab detected language", error)
        setAtom(DEFAULT_DETECTED_CODE)
      })
  }

  refreshDetectedCode()

  const cleanupDetectedCodeListener = onMessage("detectedPageLanguageChanged", (msg) => {
    setAtom(normalizeDetectedCode(msg.data.detectedCode))
  })

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      logger.info("detectedCodeAtom onMount handleVisibilityChange when: ", new Date())
      refreshDetectedCode()
    }
  }
  document.addEventListener("visibilitychange", handleVisibilityChange)

  return () => {
    cleanupDetectedCodeListener()
    document.removeEventListener("visibilitychange", handleVisibilityChange)
  }
}
