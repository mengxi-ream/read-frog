import type { LangCodeISO6393 } from '@read-frog/definitions'
import { storage } from '#imports'
import { DEFAULT_DETECTED_CODE, DETECTED_CODE_STORAGE_KEY } from '../constants/config'

export function getFinalSourceCode(sourceCode: LangCodeISO6393 | 'auto', detectedCode: LangCodeISO6393): LangCodeISO6393 {
  return sourceCode === 'auto' ? detectedCode : sourceCode
}

export async function getDetectedCodeFromStorage(): Promise<LangCodeISO6393> {
  return await storage.getItem<LangCodeISO6393>(`local:${DETECTED_CODE_STORAGE_KEY}`) ?? DEFAULT_DETECTED_CODE
}
