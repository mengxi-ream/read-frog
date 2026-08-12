import type { SubtitlesFragment } from "../../types"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  sendMessage: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/message", () => ({ sendMessage: mocks.sendMessage }))

const HOSTED_REF = {
  kind: "system" as const,
  providerId: "read-frog-advance-ai" as const,
  modelTier: "advance" as const,
  modelRevision: "advance-r1",
}
const LOCAL_REF = { kind: "local" as const, config: { id: "openai-default" } as never }

/** `chars` characters of text per fragment, one second apart. */
function makeFragments(count: number, chars: number): SubtitlesFragment[] {
  return Array.from({ length: count }, (_, i) => ({
    text: "x".repeat(chars),
    start: i * 1000,
    end: i * 1000 + 999,
  }))
}

/** Echo each input cue back as simplified VTT so the result length is countable. */
function vttEchoingInput(jsonContent: string): string {
  const cues = JSON.parse(jsonContent) as Array<{ s: number; e: number; t: string }>
  return `WEBVTT\n\n${cues.map((c) => `${c.s} --> ${c.e}\n${c.t}`).join("\n\n")}`
}

describe("aiSegmentBlock oversize handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sendMessage.mockImplementation(async (_name: string, data: { jsonContent: string }) =>
      vttEchoingInput(data.jsonContent),
    )
  })

  it("splits an oversized hosted request instead of truncating it", async () => {
    const { aiSegmentBlock } = await import("../ai-segmentation")

    // Comfortably past the 28000-char hosted prompt bound.
    const fragments = makeFragments(40, 2000)
    const result = await aiSegmentBlock(fragments, HOSTED_REF)

    expect(mocks.sendMessage.mock.calls.length).toBeGreaterThan(1)
    for (const [, data] of mocks.sendMessage.mock.calls) {
      expect(data.jsonContent.length).toBeLessThanOrEqual(28000)
    }
    // Splitting must not drop cues — that is the whole reason it is a split and
    // not a truncation.
    expect(result).toHaveLength(fragments.length)
  })

  it("sends an in-budget hosted request as a single call", async () => {
    const { aiSegmentBlock } = await import("../ai-segmentation")

    await aiSegmentBlock(makeFragments(5, 50), HOSTED_REF)

    expect(mocks.sendMessage).toHaveBeenCalledTimes(1)
  })

  it("never splits a local provider, which has no prompt cap", async () => {
    const { aiSegmentBlock } = await import("../ai-segmentation")

    await aiSegmentBlock(makeFragments(40, 2000), LOCAL_REF)

    expect(mocks.sendMessage).toHaveBeenCalledTimes(1)
  })

  it("throws rather than truncating when one fragment alone exceeds the cap", async () => {
    const { aiSegmentBlock } = await import("../ai-segmentation")

    await expect(aiSegmentBlock(makeFragments(1, 40000), HOSTED_REF)).rejects.toThrow(
      /exceeds the hosted segmentation limit/,
    )
  })
})
