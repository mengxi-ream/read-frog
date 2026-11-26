// @vitest-environment jsdom
import type { ContentRuntime } from "@/utils/content-runtime/parts"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  loaded: new Set<string>(),
  runHost: vi.fn<() => Promise<void>>(),
  runSelection: vi.fn<() => Promise<void>>(),
  runSide: vi.fn<() => Promise<void>>(),
  runSubtitles: vi.fn<() => Promise<void>>(),
}))

vi.mock("@/utils/logging/setup", () => ({ setupContentScriptLogging: vi.fn<() => void>() }))

// Each factory runs when its part's chunk is imported
vi.mock("../host/main", () => {
  mocks.loaded.add("host")
  return { runHostContent: mocks.runHost }
})
vi.mock("../selection/main", () => {
  mocks.loaded.add("selection")
  return { runSelectionContent: mocks.runSelection }
})
vi.mock("../side/main", () => {
  mocks.loaded.add("side")
  return { runSideContent: mocks.runSide }
})
vi.mock("../subtitles/main", () => {
  mocks.loaded.add("subtitles")
  return { runSubtitlesContent: mocks.runSubtitles }
})

async function loadRuntime(): Promise<ContentRuntime> {
  const { default: contentRuntime } = await import("../index")
  return contentRuntime.main()
}

describe("runContentParts", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.loaded.clear()
    delete window.__READ_FROG_SUBTITLES_INJECTED__
  })

  it("loads only the parts it is asked for", async () => {
    const runtime = await loadRuntime()

    await runtime.runContentParts(["subtitles"])

    expect([...mocks.loaded]).toEqual(["subtitles"])
    expect(mocks.runSubtitles).toHaveBeenCalledTimes(1)
  })

  it("starts a part once when two loaders ask for it while it loads", async () => {
    const runtime = await loadRuntime()

    await Promise.all([
      runtime.runContentParts(["subtitles"]),
      runtime.runContentParts(["subtitles"]),
    ])

    expect(mocks.runSubtitles).toHaveBeenCalledTimes(1)
  })

  it("does not start a part that is already running", async () => {
    const runtime = await loadRuntime()
    window.__READ_FROG_SUBTITLES_INJECTED__ = true

    await runtime.runContentParts(["subtitles"])

    expect(mocks.runSubtitles).not.toHaveBeenCalled()
  })

  it("starts a part again after it gave up", async () => {
    const runtime = await loadRuntime()

    // The part returns without setting its flag, as on a disabled site
    await runtime.runContentParts(["subtitles"])
    await runtime.runContentParts(["subtitles"])

    expect(mocks.runSubtitles).toHaveBeenCalledTimes(2)
  })

  it("keeps the other parts going when one crashes", async () => {
    const runtime = await loadRuntime()
    mocks.runHost.mockRejectedValue(new Error("boom"))

    await runtime.runContentParts(["host", "selection", "side"])

    expect(mocks.runSelection).toHaveBeenCalledTimes(1)
    expect(mocks.runSide).toHaveBeenCalledTimes(1)
  })
})
