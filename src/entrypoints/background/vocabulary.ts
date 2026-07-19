import { db } from "@/utils/db/dexie/db"
import { logger } from "@/utils/logger"
import { onMessage, sendMessage } from "@/utils/message"
import {
  getVocabularyGlossPrompt,
  parseVocabularyGlossResponse,
} from "@/utils/prompts/vocabulary-gloss"
import { runGenerateTextInBackground } from "./llm-generate-text"

const GLOSS_BATCH_SIZE = 50

function getGlossCacheKey(targetLangCode: string, word: string) {
  return `${targetLangCode}:${word}`
}

export function setupVocabularyMessageHandlers() {
  onMessage("vocabularyGetGlosses", async (message) => {
    const { words, targetLangCode, providerId } = message.data
    const result: Record<string, string> = {}

    const cached = await db.wordGlossCache.bulkGet(
      words.map((word) => getGlossCacheKey(targetLangCode, word)),
    )
    const missingWords: string[] = []
    words.forEach((word, index) => {
      const entry = cached[index]
      if (entry) {
        result[word] = entry.gloss
      } else {
        missingWords.push(word)
      }
    })

    for (let i = 0; i < missingWords.length; i += GLOSS_BATCH_SIZE) {
      const batch = missingWords.slice(i, i + GLOSS_BATCH_SIZE)
      try {
        const { systemPrompt, prompt } = getVocabularyGlossPrompt(batch, targetLangCode)
        const response = await runGenerateTextInBackground({
          providerId,
          instructions: systemPrompt,
          prompt,
        })
        const glosses = parseVocabularyGlossResponse(response.text)
        const now = new Date()
        const newEntries = batch
          .filter((word) => glosses[word])
          .map((word) => ({
            key: getGlossCacheKey(targetLangCode, word),
            gloss: glosses[word],
            createdAt: now,
          }))
        await db.wordGlossCache.bulkPut(newEntries)
        for (const word of batch) {
          if (glosses[word]) result[word] = glosses[word]
        }
      } catch (error) {
        logger.error("[Background] vocabularyGetGlosses batch failed", error)
        // Return whatever we have; the content script annotates what it can.
      }
    }

    return result
  })

  onMessage("vocabularyGetKnownWords", async () => {
    const entries = await db.knownWords.toArray()
    return entries.map((entry) => entry.word)
  })

  onMessage("vocabularyMarkKnownWord", async (message) => {
    await addKnownWord(message.data.word)
    const tabId = message.sender?.tab?.id
    if (tabId !== undefined) {
      void sendMessage("vocabularyKnownWordsChanged", undefined, tabId)
    }
  })
}

export async function addKnownWord(word: string): Promise<void> {
  await db.knownWords.put({ word, createdAt: new Date() })
}
