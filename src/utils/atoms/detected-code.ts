import type { LangCodeISO6393 } from '@read-frog/definitions'
import { langCodeISO6393Schema } from '@read-frog/definitions'
import { atom } from 'jotai'
import { DEFAULT_DETECTED_CODE, DETECTED_CODE_STORAGE_KEY } from '../constants/config'
import { logger } from '../logger'
import { storageAdapter } from './storage-adapter'

// Private base atom - not exported to prevent direct writes
const baseDetectedCodeAtom = atom<LangCodeISO6393>(DEFAULT_DETECTED_CODE)

// Public atom with read/write - write always goes through storageAdapter
export const detectedCodeAtom = atom(
  get => get(baseDetectedCodeAtom),
  async (get, set, newValue: LangCodeISO6393) => {
    const prev = get(baseDetectedCodeAtom)
    set(baseDetectedCodeAtom, newValue)
    try {
      await storageAdapter.set(DETECTED_CODE_STORAGE_KEY, newValue, langCodeISO6393Schema)
    }
    catch (error) {
      console.error('Failed to set detectedCode to storage:', newValue, error)
      set(baseDetectedCodeAtom, prev)
    }
  },
)

// onMount on base atom - gets triggered when derived atom subscribes
baseDetectedCodeAtom.onMount = (setAtom: (newValue: LangCodeISO6393) => void) => {
  void storageAdapter.get<LangCodeISO6393>(DETECTED_CODE_STORAGE_KEY, DEFAULT_DETECTED_CODE, langCodeISO6393Schema).then(setAtom)
  const unwatch = storageAdapter.watch<LangCodeISO6393>(DETECTED_CODE_STORAGE_KEY, setAtom)

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      logger.info('detectedCodeAtom onMount handleVisibilityChange when: ', new Date())
      void storageAdapter.get<LangCodeISO6393>(DETECTED_CODE_STORAGE_KEY, DEFAULT_DETECTED_CODE, langCodeISO6393Schema).then(setAtom)
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    unwatch()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}
