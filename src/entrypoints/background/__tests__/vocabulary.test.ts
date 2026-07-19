import { beforeEach, describe, expect, it, vi } from "vitest"

const knownWordsPutMock = vi.fn<(...args: any[]) => any>()
const knownWordsToArrayMock = vi.fn<(...args: any[]) => any>()
const wordGlossCacheBulkGetMock = vi.fn<(...args: any[]) => any>()
const wordGlossCacheBulkPutMock = vi.fn<(...args: any[]) => any>()
const runGenerateTextInBackgroundMock = vi.fn<(...args: any[]) => any>()
const onMessageMock = vi.fn<(...args: any[]) => any>()
const sendMessageMock = vi.fn<(...args: any[]) => any>()

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
  sendMessage: sendMessageMock,
}))

vi.mock("../llm-generate-text", () => ({
  runGenerateTextInBackground: runGenerateTextInBackgroundMock,
}))

function getRegisteredMessageHandler(name: string) {
  const registration = onMessageMock.mock.calls.find((call) => call[0] === name)
  if (!registration) {
    throw new Error(`Message handler not registered: ${name}`)
  }
  return registration[1] as (message: { data: any; sender?: any }) => Promise<any>
}

describe("background vocabulary", () => {
  let vocabulary: typeof import("../vocabulary")

  beforeEach(async () => {
    vi.clearAllMocks()
    vocabulary = await import("../vocabulary")
    vocabulary.setupVocabularyMessageHandlers()
  })

  it("marks a word as known via addKnownWord", async () => {
    await vocabulary.addKnownWord("serendipity")

    expect(knownWordsPutMock).toHaveBeenCalledWith(expect.objectContaining({ word: "serendipity" }))
  })

  it("returns known words from vocabularyGetKnownWords", async () => {
    knownWordsToArrayMock.mockResolvedValue([
      { word: "serendipity", createdAt: new Date() },
      { word: "quixotic", createdAt: new Date() },
    ])

    const handler = getRegisteredMessageHandler("vocabularyGetKnownWords")
    const result = await handler({ data: undefined })

    expect(result).toEqual(["serendipity", "quixotic"])
  })

  it("serves cached glosses without calling the LLM", async () => {
    wordGlossCacheBulkGetMock.mockResolvedValue([{ key: "cmn:serendipity", gloss: "机缘巧合" }])

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

    const handler = getRegisteredMessageHandler("vocabularyGetGlosses")
    const result = await handler({
      data: { words: ["quixotic"], targetLangCode: "cmn", providerId: "test-provider" },
    })

    expect(result).toEqual({})
    expect(wordGlossCacheBulkPutMock).not.toHaveBeenCalled()
  })

  it("marks a word known and notifies the sender tab to re-walk", async () => {
    const handler = getRegisteredMessageHandler("vocabularyMarkKnownWord")
    await handler({ data: { word: "serendipity" }, sender: { tab: { id: 7 } } })

    expect(knownWordsPutMock).toHaveBeenCalledWith(expect.objectContaining({ word: "serendipity" }))
    expect(sendMessageMock).toHaveBeenCalledWith("vocabularyKnownWordsChanged", undefined, 7)
  })

  it("skips notifying when the message has no sender tab", async () => {
    const handler = getRegisteredMessageHandler("vocabularyMarkKnownWord")
    await handler({ data: { word: "quixotic" }, sender: {} })

    expect(knownWordsPutMock).toHaveBeenCalledWith(expect.objectContaining({ word: "quixotic" }))
    expect(sendMessageMock).not.toHaveBeenCalled()
  })
})
