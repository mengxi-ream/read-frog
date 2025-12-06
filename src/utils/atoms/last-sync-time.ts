import { storage } from '#imports'
import { atom } from 'jotai'
import { LAST_SYNC_TIME_STORAGE_KEY } from '../constants/config'

// internal atom for storing last sync time
const _lastSyncTimeBaseAtom = atom<number | null>(null)

_lastSyncTimeBaseAtom.onMount = (setAtom: (newValue: number | null) => void) => {
  void storage.getItem<number>(`local:${LAST_SYNC_TIME_STORAGE_KEY}`).then(v => setAtom(v ?? null))

  const unwatch = storage.watch<number>(`local:${LAST_SYNC_TIME_STORAGE_KEY}`, (newValue) => {
    setAtom(newValue ?? null)
  })

  return unwatch
}

// export read-only derived atom
export const lastSyncTimeAtom = atom(get => get(_lastSyncTimeBaseAtom))
