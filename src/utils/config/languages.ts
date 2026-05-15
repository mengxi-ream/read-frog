import type { LangCodeISO6393 } from "@read-frog/definitions"
import { DEFAULT_DETECTED_CODE } from "../constants/config"
import { sendMessage } from "../message"

export function getFinalSourceCode(sourceCode: LangCodeISO6393 | "auto", detectedCode: LangCodeISO6393): LangCodeISO6393 {
  return sourceCode === "auto" ? detectedCode : sourceCode
}

export async function getDetectedCodeFromStorage(): Promise<LangCodeISO6393> {
  try {
    return await sendMessage("getDetectedCode", undefined)
  }
  catch {
    return DEFAULT_DETECTED_CODE
  }
}
