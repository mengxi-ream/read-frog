import { beforeEach, describe, expect, it, vi } from "vitest"

const knownWordsPutMock = vi.fn<(...args: any[]) => any>()
const knownWordsToArrayMock = vi.fn<(...args: any[]) => any>()
const wordGlossCacheBulkGetMock = vi.fn<(...args: any[]) => any>()
const wordGlossCacheBulkPutMock = vi.fn<(...args: any[]) => any>()
const runGenerateTextInBackgroundMock = vi.fn<(...args: any[]) => any>()
const onMessageMock = vi.fn<(...args: any[]) => any>()

vi.mock("@/utils/db/dexie/db", () => ({
  db: {
    knownWords: {
      put: knownWordsPutMock,
      toArray: knownWordsToArrayMock,
    },
    wordGlossCache: {
      bulkGet: wordGlossCacheBulkGetMock,
      bulkPut: wordGlossCacheBulkPutMock,
    },
  },
}))

vi.mock("@/utils/message", () => ({
  onMessage: onMessageMock,
}))

vi.mock("../llm-generate-text", () => ({
  runGenerateTextInBackground: runGenerateTextInBackgroundMock,
}))

function getRegisteredMessageHandler(name: string) {
  const registration = onMessageMock.mock.calls.find((call) => call[0] === name)
  if (!registration) {
    throw new Error(`Message handler not registered: ${name}`)
  }
  return registration[1] as (message: { data: any }) => Promise<any>
}

describe("background vocabulary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("marks a word as known via addKnownWord", async () => {
    const { addKnownWord } = await import("../vocabulary")

    await addKnownWord("serendipity")

    expect(knownWordsPutMock).toHaveBeenCalledWith(expect.objectContaining({ word: "serendipity" }))
  })

  it("returns known words from vocabularyGetKnownWords", async () => {
    knownWordsToArrayMock.mockResolvedValue([
      { word: "serendipity", createdAt: new Date() },
      { word: "quixotic", createdAt: new Date() },
    ])

    const { setupVocabularyMessageHandlers } = await import("../vocabulary")
    setupVocabularyMessageHandlers()

    const handler = getRegisteredMessageHandler("vocabularyGetKnownWords")
    const result = await handler({ data: undefined })

    expect(result).toEqual(["serendipity", "quixotic"])
  })

  it("serves cached glosses without calling the LLM", async () => {
    wordGlossCacheBulkGetMock.mockResolvedValue([{ key: "cmn:serendipity", gloss: "机缘巧合" }])

    const { setupVocabularyMessageHandlers } = await import("../vocabulary")
    setupVocabularyMessageHandlers()

    const handler = getRegisteredMessageHandler("vocabularyGetGlosses")
    const result = await handler({
      data: { words: ["serendipity"], targetLangCode: "cmn", providerId: "test-provider" },
    })

    expect(result).toEqual({ serendipity: "机缘巧合" })
    expect(runGenerateTextInBackgroundMock).not.toHaveBeenCalled()
  })

  it("fetches and caches glosses for words missing from the cache", async () => {
    wordGlossCacheBulkGetMock.mockResolvedValue([undefined])
    runGenerateTextInBackgroundMock.mockResolvedValue({
      text: JSON.stringify({ quixotic: "不切实际的" }),
    })

    const { setupVocabularyMessageHandlers } = await import("../vocabulary")
    setupVocabularyMessageHandlers()

    const handler = getRegisteredMessageHandler("vocabularyGetGlosses")
    const result = await handler({
      data: { words: ["quixotic"], targetLangCode: "cmn", providerId: "test-provider" },
    })

    expect(result).toEqual({ quixotic: "不切实际的" })
    expect(wordGlossCacheBulkPutMock).toHaveBeenCalledWith([
      expect.objectContaining({ key: "cmn:quixotic", gloss: "不切实际的" }),
    ])
  })

  it("returns partial results when a gloss batch fails", async () => {
    wordGlossCacheBulkGetMock.mockResolvedValue([undefined])
    runGenerateTextInBackgroundMock.mockRejectedValue(new Error("network error"))

    const { setupVocabularyMessageHandlers } = await import("../vocabulary")
    setupVocabularyMessageHandlers()

    const handler = getRegisteredMessageHandler("vocabularyGetGlosses")
    const result = await handler({
      data: { words: ["quixotic"], targetLangCode: "cmn", providerId: "test-provider" },
    })

    expect(result).toEqual({})
    expect(wordGlossCacheBulkPutMock).not.toHaveBeenCalled()
  })
})
