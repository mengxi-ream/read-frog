import { describe, expect, it, vi } from "vitest"
import { TranslationCoordinator } from "../translation-coordinator"

describe("translation coordinator loading state", () => {
  it("sets loading for the active untranslated cue", () => {
    const onStateChange = vi.fn<(...args: any[]) => any>()
    const coordinator = new TranslationCoordinator({
      getFragments: () => [{ text: "hello", start: 0, end: 1000 }],
      getVideoElement: () => ({ currentTime: 0.5 }) as HTMLVideoElement,
      getCurrentState: () => "idle",
      segmentationPipeline: null,
      onTranslated: vi.fn<(...args: any[]) => any>(),
      onStateChange,
    })

    ;(coordinator as any).updateLoadingStateAt(500, [{ text: "hello", start: 0, end: 1000 }])

    expect(onStateChange).toHaveBeenCalledWith("loading")
  })

  it("does not keep loading in a cue gap just because the next cue is untranslated", () => {
    const onStateChange = vi.fn<(...args: any[]) => any>()
    const coordinator = new TranslationCoordinator({
      getFragments: () => [
        { text: "hello", start: 0, end: 1000 },
        { text: "world", start: 2000, end: 3000 },
      ],
      getVideoElement: () => ({ currentTime: 1.5 }) as HTMLVideoElement,
      getCurrentState: () => "loading",
      segmentationPipeline: null,
      onTranslated: vi.fn<(...args: any[]) => any>(),
      onStateChange,
    })

    // Pretend we were loading on the previous cue.
    ;(coordinator as any).lastEmittedState = "loading"
    ;(coordinator as any).updateLoadingStateAt(1500, [
      { text: "hello", start: 0, end: 1000 },
      { text: "world", start: 2000, end: 3000 },
    ])

    expect(onStateChange).toHaveBeenCalledWith("idle")
  })

  it("clears adapter loading during a music intro with no active cue", () => {
    const onStateChange = vi.fn<(...args: any[]) => any>()
    const coordinator = new TranslationCoordinator({
      getFragments: () => [{ text: "lyrics start later", start: 30_000, end: 31_000 }],
      getVideoElement: () => ({ currentTime: 5 }) as HTMLVideoElement,
      // Scheduler was set to loading while source subtitles were fetched.
      getCurrentState: () => "loading",
      segmentationPipeline: null,
      onTranslated: vi.fn<(...args: any[]) => any>(),
      onStateChange,
    })

    // Coordinator starts with lastEmittedState = "idle", which previously skipped clear.
    ;(coordinator as any).updateLoadingStateAt(5_000, [
      { text: "lyrics start later", start: 30_000, end: 31_000 },
    ])

    expect(onStateChange).toHaveBeenCalledWith("idle")
  })

  it("does not chain another translation tick after stop", async () => {
    const onTranslated = vi.fn<(...args: any[]) => any>()
    const onStateChange = vi.fn<(...args: any[]) => any>()
    let resolveTranslate!: (value: any) => void
    const translatePromise = new Promise((resolve) => {
      resolveTranslate = resolve
    })

    const translator = await import("@/utils/subtitles/processor/translator")
    const spy = vi
      .spyOn(translator, "translateSubtitles")
      .mockImplementation(() => translatePromise as any)

    const coordinator = new TranslationCoordinator({
      getFragments: () => [
        { text: "a", start: 0, end: 1000 },
        { text: "b", start: 1000, end: 2000 },
        { text: "c", start: 2000, end: 3000 },
        { text: "d", start: 3000, end: 4000 },
        { text: "e", start: 4000, end: 5000 },
        { text: "f", start: 5000, end: 6000 },
      ],
      getVideoElement: () =>
        ({
          currentTime: 0,
          addEventListener: vi.fn<(...args: any[]) => any>(),
          removeEventListener: vi.fn<(...args: any[]) => any>(),
        }) as unknown as HTMLVideoElement,
      getCurrentState: () => "idle",
      segmentationPipeline: null,
      onTranslated,
      onStateChange,
    })

    coordinator.start()
    await Promise.resolve()
    expect(spy).toHaveBeenCalledTimes(1)

    coordinator.stop()
    const batch = spy.mock.calls[0][0] as Array<{ text: string; start: number; end: number }>
    resolveTranslate(batch.map((f) => ({ ...f, translation: `t:${f.text}` })))
    await Promise.resolve()
    await Promise.resolve()

    // In-flight call may finish, but stop must not chain another nearby batch.
    expect(spy).toHaveBeenCalledTimes(1)
    expect(onTranslated).not.toHaveBeenCalled()

    spy.mockRestore()
  })

  it("invalidates translated bookkeeping when the same start is recut", () => {
    let fragments = [{ text: "hello world", start: 0, end: 2000 }]
    const onStateChange = vi.fn<(...args: any[]) => any>()
    const coordinator = new TranslationCoordinator({
      getFragments: () => fragments,
      getVideoElement: () =>
        ({
          currentTime: 0.2,
          addEventListener: vi.fn<(...args: any[]) => any>(),
          removeEventListener: vi.fn<(...args: any[]) => any>(),
        }) as unknown as HTMLVideoElement,
      getCurrentState: () => "idle",
      segmentationPipeline: null,
      onTranslated: vi.fn<(...args: any[]) => any>(),
      onStateChange,
    })

    // noteFragmentListChanged is a no-op when inactive.
    ;(coordinator as any).active = true
    ;(coordinator as any).translatedStarts.add(0)
    ;(coordinator as any).knownIdentities.set(0, "2000\0hello world")

    // AI re-segmentation keeps start=0 but shortens the cue.
    fragments = [
      { text: "hello", start: 0, end: 1000 },
      { text: "world", start: 1000, end: 2000 },
    ]
    coordinator.noteFragmentListChanged()

    // Old completion must be invalidated so the recut line can be translated again.
    expect((coordinator as any).translatedStarts.has(0)).toBe(false)
    // Old baseline identity must not stick around as if still valid.
    expect((coordinator as any).knownIdentities.get(0)).not.toBe("2000\0hello world")
  })

  it("does not apply in-flight results after stop then start", async () => {
    const onTranslated = vi.fn<(...args: any[]) => any>()
    const resolvers: Array<(value: any) => void> = []
    const translator = await import("@/utils/subtitles/processor/translator")
    const spy = vi.spyOn(translator, "translateSubtitles").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve)
        }) as any,
    )

    const coordinator = new TranslationCoordinator({
      getFragments: () => [{ text: "a", start: 0, end: 1000 }],
      getVideoElement: () =>
        ({
          currentTime: 0.2,
          addEventListener: vi.fn<(...args: any[]) => any>(),
          removeEventListener: vi.fn<(...args: any[]) => any>(),
        }) as unknown as HTMLVideoElement,
      getCurrentState: () => "idle",
      segmentationPipeline: null,
      onTranslated,
      onStateChange: vi.fn<(...args: any[]) => any>(),
    })

    coordinator.start()
    await Promise.resolve()
    expect(spy).toHaveBeenCalledTimes(1)

    coordinator.stop()
    coordinator.start()
    await Promise.resolve()
    // Resume must be able to start a new batch (isTranslating not stuck).
    expect(spy).toHaveBeenCalledTimes(2)

    // Stale first-run result.
    resolvers[0]([{ text: "a", start: 0, end: 1000, translation: "STALE" }])
    await Promise.resolve()
    await Promise.resolve()
    expect(onTranslated).not.toHaveBeenCalled()

    // Current-run result.
    resolvers[1]([{ text: "a", start: 0, end: 1000, translation: "FRESH" }])
    await Promise.resolve()
    await Promise.resolve()
    expect(onTranslated).toHaveBeenCalledWith([expect.objectContaining({ translation: "FRESH" })])

    spy.mockRestore()
  })

  it("does not publish stale batch cues on translation failure after a recut", async () => {
    let fragments = [
      { text: "hello world", start: 0, end: 2000 },
      { text: "next", start: 2000, end: 3000 },
    ]
    const onTranslated = vi.fn<(...args: any[]) => any>()
    const onStateChange = vi.fn<(...args: any[]) => any>()

    const translator = await import("@/utils/subtitles/processor/translator")
    const spy = vi
      .spyOn(translator, "translateSubtitles")
      .mockRejectedValue(new Error("translate failed"))

    const config = await import("@/utils/config/storage")
    const configSpy = vi.spyOn(config, "getLocalConfig").mockResolvedValue({
      videoSubtitles: { style: { displayMode: "bilingual" } },
    } as any)

    const coordinator = new TranslationCoordinator({
      getFragments: () => fragments,
      getVideoElement: () =>
        ({
          currentTime: 0.2,
          addEventListener: vi.fn<(...args: any[]) => any>(),
          removeEventListener: vi.fn<(...args: any[]) => any>(),
        }) as unknown as HTMLVideoElement,
      getCurrentState: () => "idle",
      segmentationPipeline: null,
      onTranslated,
      onStateChange,
    })

    coordinator.start()
    await Promise.resolve()
    // Recut mid-request: original cue is gone; only identity-valid fallbacks may publish.
    fragments = [
      { text: "hello", start: 0, end: 1000 },
      { text: "world", start: 1000, end: 2000 },
      { text: "next", start: 2000, end: 3000 },
    ]
    await vi.waitFor(() => {
      expect(onStateChange).toHaveBeenCalledWith("error", { message: "translate failed" })
    })

    // Stale full-batch fallback would re-introduce the pre-recut cue as a zombie.
    const published = onTranslated.mock.calls.flatMap((call) => call[0] as any[])
    expect(published.every((f) => f.text !== "hello world")).toBe(true)
    // Empty translation fallbacks for still-valid cues are fine; identity-mismatched are not.
    expect(published.some((f) => f.start === 0 && f.end === 2000)).toBe(false)

    spy.mockRestore()
    configSpy.mockRestore()
  })
})
