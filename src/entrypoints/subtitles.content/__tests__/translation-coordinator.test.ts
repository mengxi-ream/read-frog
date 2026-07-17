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

  it("invalidates translated bookkeeping when the same start is recut", () => {
    let fragments = [{ text: "hello world", start: 0, end: 2000 }]
    const onStateChange = vi.fn<(...args: any[]) => any>()
    const coordinator = new TranslationCoordinator({
      getFragments: () => fragments,
      getVideoElement: () => ({ currentTime: 0.2 }) as HTMLVideoElement,
      getCurrentState: () => "idle",
      segmentationPipeline: null,
      onTranslated: vi.fn<(...args: any[]) => any>(),
      onStateChange,
    })

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
})
