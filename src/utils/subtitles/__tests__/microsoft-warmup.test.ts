import type { SubtitlesFragment } from "../types"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { sendMessage } from "@/utils/message"
import { microsoftWarmupTranslate } from "../warmup/microsoft-warmup"

vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn(),
}))

vi.mock("@/utils/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const mockSendMessage = vi.mocked(sendMessage)

function makeFragment(text: string, start: number, end?: number): SubtitlesFragment {
  return { text, start, end: end ?? start + 1000 }
}

describe("microsoftWarmupTranslate", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns empty array for empty input", async () => {
    const result = await microsoftWarmupTranslate([], "en", "zh")
    expect(result).toEqual([])
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it("translates a single fragment", async () => {
    mockSendMessage.mockResolvedValueOnce(["你好"] as never)

    const fragments = [makeFragment("Hello", 0)]
    const result = await microsoftWarmupTranslate(fragments, "en", "zh")

    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    expect(mockSendMessage).toHaveBeenCalledWith("microsoftBatchTranslate", {
      texts: ["Hello"],
      fromLang: "en",
      toLang: "zh",
    })
    expect(result).toHaveLength(1)
    expect(result[0].translation).toBe("你好")
    expect(result[0].text).toBe("Hello")
    expect(result[0].start).toBe(0)
  })

  it("translates multiple fragments in one chunk", async () => {
    mockSendMessage.mockResolvedValueOnce(["你好", "世界", "今天"] as never)

    const fragments = [
      makeFragment("Hello", 0),
      makeFragment("World", 1000),
      makeFragment("Today", 2000),
    ]
    const result = await microsoftWarmupTranslate(fragments, "en", "zh")

    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(3)
    expect(result[0].translation).toBe("你好")
    expect(result[1].translation).toBe("世界")
    expect(result[2].translation).toBe("今天")
  })

  it("splits fragments into chunks by element count (100 max)", async () => {
    const fragments = Array.from({ length: 150 }, (_, i) =>
      makeFragment(`Text ${i}`, i * 1000),
    )

    mockSendMessage
      .mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => `翻译 ${i}`) as never)
      .mockResolvedValueOnce(Array.from({ length: 50 }, (_, i) => `翻译 ${100 + i}`) as never)

    const result = await microsoftWarmupTranslate(fragments, "en", "zh")

    expect(mockSendMessage).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(150)
    expect(result[0].translation).toBe("翻译 0")
    expect(result[99].translation).toBe("翻译 99")
    expect(result[100].translation).toBe("翻译 100")
    expect(result[149].translation).toBe("翻译 149")
  })

  it("splits fragments into chunks by character count (50000 max)", async () => {
    const longText = "a".repeat(30_000)
    const fragments = [
      makeFragment(longText, 0),
      makeFragment(longText, 1000),
      makeFragment("short", 2000),
    ]

    // chunk1: [frag0] (30K chars), chunk2: [frag1, frag2] (30K + 5 < 50K)
    mockSendMessage
      .mockResolvedValueOnce(["翻译1"] as never)
      .mockResolvedValueOnce(["翻译2", "短"] as never)

    const result = await microsoftWarmupTranslate(fragments, "en", "zh")

    expect(mockSendMessage).toHaveBeenCalledTimes(2)
    expect(result[0].translation).toBe("翻译1")
    expect(result[1].translation).toBe("翻译2")
    expect(result[2].translation).toBe("短")
  })

  it("handles partial chunk failure gracefully", async () => {
    const fragments = Array.from({ length: 150 }, (_, i) =>
      makeFragment(`Text ${i}`, i * 1000),
    )

    // chunk1: 100 fragments succeeds, chunk2: 50 fragments fails
    mockSendMessage
      .mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => `翻译 ${i}`) as never)
      .mockRejectedValueOnce(new Error("Network error") as never)

    const result = await microsoftWarmupTranslate(fragments, "en", "zh")

    expect(result).toHaveLength(150)
    expect(result[0].translation).toBe("翻译 0")
    expect(result[99].translation).toBe("翻译 99")
    // Second chunk failed — translations remain undefined
    expect(result[100].translation).toBeUndefined()
    expect(result[149].translation).toBeUndefined()
  })

  it("preserves original fragment properties", async () => {
    mockSendMessage.mockResolvedValueOnce(["你好"] as never)

    const fragments = [{ text: "Hello", start: 500, end: 1500 }]
    const result = await microsoftWarmupTranslate(fragments, "en", "zh")

    expect(result[0]).toEqual({
      text: "Hello",
      start: 500,
      end: 1500,
      translation: "你好",
    })
  })

  it("does not mutate input fragments", async () => {
    mockSendMessage.mockResolvedValueOnce(["你好"] as never)

    const original: SubtitlesFragment = { text: "Hello", start: 0, end: 1000 }
    const fragments = [original]
    const result = await microsoftWarmupTranslate(fragments, "en", "zh")

    expect(original.translation).toBeUndefined()
    expect(result[0].translation).toBe("你好")
  })
})
