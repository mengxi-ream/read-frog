import type { YoutubeTimedText } from "../fetchers/youtube/types"
import { describe, expect, it } from "vitest"
import { filterNoiseFromEvents } from "../fetchers/youtube/noise-filter"

describe("noise Filter", () => {
  describe("filterNoiseFromEvents", () => {
    it("should filter out [Music] annotations", () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "[Music]" }] },
      ]
      const result = filterNoiseFromEvents(events)
      expect(result[0].segs).toHaveLength(0)
    })

    it("should filter out (Applause) annotations", () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "(Applause)" }] },
      ]
      const result = filterNoiseFromEvents(events)
      expect(result[0].segs).toHaveLength(0)
    })

    it("should filter out music note annotations", () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "♪ Music ♪" }] },
        { tStartMs: 1000, dDurationMs: 1000, segs: [{ utf8: "🎵 Song 🎵" }] },
        { tStartMs: 2000, dDurationMs: 1000, segs: [{ utf8: "🎶 Melody 🎶" }] },
      ]
      const result = filterNoiseFromEvents(events)
      expect(result[0].segs).toHaveLength(0)
      expect(result[1].segs).toHaveLength(0)
      expect(result[2].segs).toHaveLength(0)
    })

    it("should keep text after removing speaker annotation", () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "[Speaker 1] Hello world" }] },
      ]
      const result = filterNoiseFromEvents(events)
      expect(result[0].segs).toHaveLength(1)
      expect(result[0].segs![0].utf8).toBe(" Hello world")
    })

    it("should remove noise in the middle of text", () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "Hello [Music] World" }] },
      ]
      const result = filterNoiseFromEvents(events)
      expect(result[0].segs).toHaveLength(1)
      expect(result[0].segs![0].utf8).toBe("Hello  World")
    })

    it("should handle multiple noise patterns in one segment", () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "[Music] Hello (Applause)" }] },
      ]
      const result = filterNoiseFromEvents(events)
      expect(result[0].segs).toHaveLength(1)
      expect(result[0].segs![0].utf8).toBe(" Hello ")
    })

    it("should preserve events without segs", () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 0, dDurationMs: 1000 },
      ]
      const result = filterNoiseFromEvents(events)
      expect(result).toHaveLength(1)
      expect(result[0].segs).toBeUndefined()
    })

    it("should preserve timing information", () => {
      const events: YoutubeTimedText[] = [
        { tStartMs: 1234, dDurationMs: 5678, segs: [{ utf8: "[Music]", tOffsetMs: 100 }] },
      ]
      const result = filterNoiseFromEvents(events)
      expect(result[0].tStartMs).toBe(1234)
      expect(result[0].dDurationMs).toBe(5678)
    })

    it("should handle empty events array", () => {
      const result = filterNoiseFromEvents([])
      expect(result).toEqual([])
    })

    it("should handle multiple segs in one event", () => {
      const events: YoutubeTimedText[] = [
        {
          tStartMs: 0,
          dDurationMs: 1000,
          segs: [
            { utf8: "[Music]" },
            { utf8: "Hello" },
            { utf8: "(Applause)" },
          ],
        },
      ]
      const result = filterNoiseFromEvents(events)
      expect(result[0].segs).toHaveLength(1)
      expect(result[0].segs![0].utf8).toBe("Hello")
    })

    it("should preserve tOffsetMs in segs", () => {
      const events: YoutubeTimedText[] = [
        {
          tStartMs: 0,
          dDurationMs: 1000,
          segs: [{ utf8: "Hello", tOffsetMs: 500 }],
        },
      ]
      const result = filterNoiseFromEvents(events)
      expect(result[0].segs![0].tOffsetMs).toBe(500)
    })
  })
})
