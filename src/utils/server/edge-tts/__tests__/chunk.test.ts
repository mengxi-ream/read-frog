import { describe, expect, it } from "vitest"
import { splitTextByUtf8Bytes } from "../chunk"

function getUtf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length
}

describe("splitTextByUtf8Bytes", () => {
  it("splits long CJK text into chunks within byte limit", () => {
    const text = "你好世界".repeat(800)
    const chunks = splitTextByUtf8Bytes(text, 1800, 60)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every(chunk => getUtf8Bytes(chunk) <= 1800)).toBe(true)
  })

  it("does not split inside html entities when possible", () => {
    const text = "hello &amp; welcome"
    const chunks = splitTextByUtf8Bytes(text, 8, 10)

    expect(chunks[0]?.includes("&")).toBe(false)
  })

  it("keeps surrogate pairs intact when splitting by bytes", () => {
    const text = "🙂🙂🙂"
    const chunks = splitTextByUtf8Bytes(text, 5, 10)

    expect(chunks.every(chunk => !chunk.includes("\uFFFD"))).toBe(true)
    expect(chunks.join("")).toBe(text)
  })

  it("never returns a chunk that exceeds the byte limit after boundary adjustment", () => {
    const maxBytes = 9
    const chunks = splitTextByUtf8Bytes("你你你 你好", maxBytes, 10)

    expect(chunks.every(chunk => getUtf8Bytes(chunk) <= maxBytes)).toBe(true)
  })

  it("throws when chunk count exceeds the configured limit", () => {
    const text = "a ".repeat(200)

    expect(() => splitTextByUtf8Bytes(text, 5, 2)).toThrowError(/max 2 chunks/i)
  })
})
