import { browser } from "#imports"
import { loadVocabularyDictionary } from "@/utils/vocabulary-hunter/dictionary-data"
import {
  getVocabularyHunterState,
  setVocabularyHunterState,
} from "@/utils/vocabulary-hunter/storage"
import { syncKnownWords, syncWordsToWordHunterGist } from "@/utils/vocabulary-hunter/sync"

const ALARM_NAME = "read-frog-vocabulary-gist-sync"
let running = false

async function runVocabularyGistSync() {
  if (running) return
  const state = await getVocabularyHunterState()
  if (!state.gistAutoSync || !state.gistId || !state.gistToken) return
  running = true
  try {
    const dictionary = await loadVocabularyDictionary()
    const knownWords = Object.entries(state.statuses)
      .filter(([, status]) => status === "known")
      .map(([word]) => word)
    const synced = await syncWordsToWordHunterGist(state.gistId, state.gistToken, knownWords)
    const statuses = { ...state.statuses }
    const mergedWords = new Set<string>()
    synced.words.forEach((word) => {
      const lemma = dictionary.get(word.toLocaleLowerCase())?.lemma ?? word.toLocaleLowerCase()
      statuses[lemma] = "known"
      mergedWords.add(lemma)
    })
    await syncKnownWords(mergedWords, dictionary)
    await setVocabularyHunterState({
      ...state,
      statuses,
      gistLastSyncAt: Date.now(),
      gistLastSyncCount: synced.count,
      gistSyncError: "",
    })
  } catch (error) {
    await setVocabularyHunterState({
      ...state,
      gistSyncError: error instanceof Error ? error.message : "自动同步失败",
    })
  } finally {
    running = false
  }
}

export function setupVocabularyGistAutoSync() {
  void browser.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: 5,
  })
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) void runVocabularyGistSync()
  })
}
