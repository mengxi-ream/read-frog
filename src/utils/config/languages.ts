import type { LanguageTag } from "@read-frog/definitions"
import type { Config } from "@/types/config/config"
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

/**
 * A language config as a content script sent it, with its languages as tags. A
 * content script from before languages were keyed by tag, still running after an
 * update, sends ISO 639-3 codes (`cmn`): the background reads them as their tags,
 * and a source it cannot read as auto-detected.
 */
export function normalizeLanguageConfig(langConfig: Config["language"]): Config["language"] {
  return {
    ...langConfig,
    sourceCode:
      langConfig.sourceCode === "auto"
        ? "auto"
        : (resolveLanguage(langConfig.sourceCode) ?? "auto"),
    targetCode: resolveLanguage(langConfig.targetCode) ?? langConfig.targetCode,
  }
}

export async function getDetectedCodeFromStorage(): Promise<LanguageTag> {
  try {
    const detectedCode = await sendMessage("getDetectedCode", undefined)
    return normalizeDetectedCode(detectedCode)
  } catch {
    return DEFAULT_DETECTED_CODE
  }
}
