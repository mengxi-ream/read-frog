import type { LangCodeISO6393 } from "@read-frog/definitions"
import { langCodeISO6393Schema } from "@read-frog/definitions"
import { DEFAULT_DETECTED_CODE } from "../constants/config"
import { sendMessage } from "../message"

export function getFinalSourceCode(sourceCode: LangCodeISO6393 | "auto", detectedCode: LangCodeISO6393): LangCodeISO6393 {
  return sourceCode === "auto" ? detectedCode : sourceCode
}

export function normalizeDetectedCode(value: unknown): LangCodeISO6393 {
  const parsedCode = langCodeISO6393Schema.safeParse(value)
  return parsedCode.success ? parsedCode.data : DEFAULT_DETECTED_CODE
}

export async function getDetectedCodeFromStorage(): Promise<LangCodeISO6393> {
  try {
    const detectedCode = await sendMessage("getDetectedCode", undefined)
    return normalizeDetectedCode(detectedCode)
  }
  catch {
    return DEFAULT_DETECTED_CODE
  }
}
