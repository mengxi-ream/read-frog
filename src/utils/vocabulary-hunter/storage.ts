import type { VocabularyLevel, VocabularyStatus } from "./candidates"
import { storage } from "#imports"

export const VOCABULARY_HUNTER_STORAGE_KEY = "local:vocabulary-hunter"
export type VocabularyDictionary = "haici" | "collins" | "longman" | "google" | "ai"

export interface VocabularyHunterState {
  enabled: boolean
  minimumLength: number
  enabledLevels: VocabularyLevel[]
  enabledDictionaries: VocabularyDictionary[]
  dictionaryOrder: VocabularyDictionary[]
  unknownHighlightColor: string
  fuzzyHighlightColor: string
  gistId: string
  gistToken: string
  gistAutoSync: boolean
  gistLastSyncAt: number
  gistLastSyncCount: number
  gistSyncError: string
  statuses: Record<string, VocabularyStatus>
}

export const DEFAULT_VOCABULARY_HUNTER_STATE: VocabularyHunterState = {
  enabled: true,
  minimumLength: 2,
  enabledLevels: ["p", "m", "h", "4", "6", "g", "o"],
  enabledDictionaries: ["haici", "collins", "longman", "google", "ai"],
  dictionaryOrder: ["haici", "collins", "longman", "google", "ai"],
  unknownHighlightColor: "#fb7185",
  fuzzyHighlightColor: "#fbbf24",
  gistId: "",
  gistToken: "",
  gistAutoSync: false,
  gistLastSyncAt: 0,
  gistLastSyncCount: 0,
  gistSyncError: "",
  statuses: {},
}

function migrateState(
  state: Omit<Partial<VocabularyHunterState>, "statuses"> & {
    statuses?: Record<string, VocabularyStatus | "learning" | "ignored">
  },
): VocabularyHunterState {
  const statuses = Object.fromEntries(
    Object.entries(state.statuses ?? {}).map(([word, status]) => [
      word,
      status === "learning" ? "fuzzy" : status === "ignored" ? "known" : status,
    ]),
  ) as Record<string, VocabularyStatus>

  return {
    ...DEFAULT_VOCABULARY_HUNTER_STATE,
    ...state,
    statuses,
  }
}

export async function getVocabularyHunterState() {
  return migrateState(
    (await storage.getItem<VocabularyHunterState>(VOCABULARY_HUNTER_STORAGE_KEY)) ?? {},
  )
}

export function setVocabularyHunterState(state: VocabularyHunterState) {
  return storage.setItem(VOCABULARY_HUNTER_STORAGE_KEY, state)
}

export function watchVocabularyHunterState(callback: (state: VocabularyHunterState) => void) {
  return storage.watch<VocabularyHunterState>(VOCABULARY_HUNTER_STORAGE_KEY, (next) => {
    callback(migrateState(next ?? {}))
  })
}
