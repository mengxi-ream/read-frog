import type { LanguageTag } from "@read-frog/definitions"
import { resolveLanguage } from "@read-frog/definitions"
import { DEFAULT_DETECTED_CODE } from "../constants/config"
import { sendMessage } from "../message"

export function getFinalSourceCode(
  sourceCode: LanguageTag | "auto",
  detectedCode: LanguageTag,
): LanguageTag {
  return sourceCode === "auto" ? detectedCode : sourceCode
}

// A detected code stored before languages were keyed by BCP 47 tag is an ISO
// 639-3 code (`cmn`); `resolveLanguage` reads both.
export function normalizeDetectedCode(value: unknown): LanguageTag {
  return (typeof value === "string" ? resolveLanguage(value) : null) ?? DEFAULT_DETECTED_CODE
}

export async function getDetectedCodeFromStorage(): Promise<LanguageTag> {
  try {
    const detectedCode = await sendMessage("getDetectedCode", undefined)
    return normalizeDetectedCode(detectedCode)
  } catch {
    return DEFAULT_DETECTED_CODE
  }
}
