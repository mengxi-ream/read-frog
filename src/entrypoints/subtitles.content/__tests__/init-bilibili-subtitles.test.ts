// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://www.bilibili.com/video/BV1XZn26rE8x/" }

import { describe, expect, it, vi } from "vitest"
import { initBilibiliSubtitles } from "../init-bilibili-subtitles"

const mocks = vi.hoisted(() => ({
  pollPlayerSubtitles: vi.fn<(...args: any[]) => void>(),
  handleSourceTrackChanged: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}))

vi.mock("../poll-player-subtitles", () => ({ pollPlayerSubtitles: mocks.pollPlayerSubtitles }))
vi.mock("../universal-adapter", () => ({
  UniversalVideoAdapter: class {
    handleSourceTrackChanged = mocks.handleSourceTrackChanged
  },
}))

describe("initBilibiliSubtitles", () => {
  it("checks the source track on every poll that finds the same video", () => {
    initBilibiliSubtitles({ onInvalidated: vi.fn<(...args: any[]) => void>() } as any)

    const { onStay } = mocks.pollPlayerSubtitles.mock.lastCall![1]
    onStay()
    expect(mocks.handleSourceTrackChanged).toHaveBeenCalledOnce()
  })
})
