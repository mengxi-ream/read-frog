import type { SubtitlesState } from "@/utils/subtitles/types"
import { afterEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
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
    const firstCall = spy.mock.calls[0]!
    const batch = firstCall[0] as Array<{ text: string; start: number; end: number }>
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
    resolvers[0]!([{ text: "a", start: 0, end: 1000, translation: "STALE" }])
    await Promise.resolve()
    await Promise.resolve()
    expect(onTranslated).not.toHaveBeenCalled()

    // Current-run result.
    resolvers[1]!([{ text: "a", start: 0, end: 1000, translation: "FRESH" }])
    await Promise.resolve()
    await Promise.resolve()
    expect(onTranslated).toHaveBeenCalledWith([expect.objectContaining({ translation: "FRESH" })])

    spy.mockRestore()
  })

  it("widens the translation look-ahead window with playback rate", async () => {
    const translator = await import("@/utils/subtitles/processor/translator")

    async function firstBatchStartsAtRate(playbackRate: number): Promise<number[]> {
      const spy = vi
        .spyOn(translator, "translateSubtitles")
        .mockImplementation((batch: any) => Promise.resolve(batch) as any)

      const coordinator = new TranslationCoordinator({
        // Only reachable at higher rates.
        getFragments: () => [{ text: "far", start: 60_000, end: 61_000 }],
        getVideoElement: () =>
          ({
            currentTime: 0,
            playbackRate,
            addEventListener: vi.fn<(...args: any[]) => any>(),
            removeEventListener: vi.fn<(...args: any[]) => any>(),
          }) as unknown as HTMLVideoElement,
        getCurrentState: () => "idle",
        segmentationPipeline: null,
        onTranslated: vi.fn<(...args: any[]) => any>(),
        onStateChange: vi.fn<(...args: any[]) => any>(),
      })

      coordinator.start()
      await Promise.resolve()
      coordinator.stop()

      const batch = (spy.mock.calls[0]?.[0] ?? []) as Array<{ start: number }>
      spy.mockRestore()
      return batch.map((f) => f.start)
    }

    // 1x: 30s window excludes the 60s cue.
    expect(await firstBatchStartsAtRate(1)).toEqual([])
    // 3x: 90s window now reaches the 60s cue.
    expect(await firstBatchStartsAtRate(3)).toEqual([60_000])
  })

  async function batchSizesDuringPlayback(
    batchLimits: { maxItemsPerBatch: number; maxCharactersPerBatch: number },
    text: (index: number) => string,
  ): Promise<number[]> {
    const translator = await import("@/utils/subtitles/processor/translator")
    const spy = vi
      .spyOn(translator, "translateSubtitles")
      .mockImplementation((batch: any) => Promise.resolve(batch) as any)
    const fragments = Array.from({ length: 60 }, (_, i) => ({
      text: text(i),
      start: i * 2000,
      end: i * 2000 + 2000,
    }))
    const video = {
      currentTime: 0,
      addEventListener: vi.fn<(...args: any[]) => any>(),
      removeEventListener: vi.fn<(...args: any[]) => any>(),
    }
    const coordinator = new TranslationCoordinator({
      getFragments: () => fragments,
      getVideoElement: () => video as unknown as HTMLVideoElement,
      getCurrentState: () => "idle",
      segmentationPipeline: null,
      onTranslated: vi.fn<(...args: any[]) => any>(),
      onStateChange: vi.fn<(...args: any[]) => any>(),
      batchLimits,
    })

    coordinator.start()
    for (let seconds = 0; seconds <= 60; seconds += 0.5) {
      video.currentTime = seconds
      coordinator.requestTick()
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    coordinator.stop()

    const sizes = spy.mock.calls.map((call) => (call[0] as unknown[]).length)
    spy.mockRestore()
    return sizes
  }

  it("keeps filling requests to the item limit while playback slides the window", async () => {
    const sizes = await batchSizesDuringPlayback(
      { maxItemsPerBatch: 5, maxCharactersPerBatch: 1000 },
      (i) => `line ${i}`,
    )

    // 30s of look-ahead plus 60s of playback reaches 45 of the 2s cues.
    expect(sizes.length).toBeGreaterThanOrEqual(9)
    expect(sizes.every((size) => size === 5)).toBe(true)
  })

  it("stops a request at the character limit", async () => {
    const sizes = await batchSizesDuringPlayback(
      { maxItemsPerBatch: 10, maxCharactersPerBatch: 25 },
      () => "ten chars!",
    )

    expect(sizes.length).toBeGreaterThan(0)
    expect(sizes.every((size) => size === 2)).toBe(true)
  })

  it("applies a batch limit change made while the video plays", async () => {
    const translator = await import("@/utils/subtitles/processor/translator")
    const spy = vi
      .spyOn(translator, "translateSubtitles")
      .mockImplementation((batch: any) => Promise.resolve(batch) as any)
    const fragments = Array.from({ length: 60 }, (_, i) => ({
      text: `line ${i}`,
      start: i * 2000,
      end: i * 2000 + 2000,
    }))
    const video = {
      currentTime: 0,
      addEventListener: vi.fn<(...args: any[]) => any>(),
      removeEventListener: vi.fn<(...args: any[]) => any>(),
    }
    const coordinator = new TranslationCoordinator({
      getFragments: () => fragments,
      getVideoElement: () => video as unknown as HTMLVideoElement,
      getCurrentState: () => "idle",
      segmentationPipeline: null,
      onTranslated: vi.fn<(...args: any[]) => any>(),
      onStateChange: vi.fn<(...args: any[]) => any>(),
      batchLimits: { maxItemsPerBatch: 2, maxCharactersPerBatch: 1000 },
    })

    coordinator.start()
    await new Promise((resolve) => setTimeout(resolve, 0))

    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, {
      ...DEFAULT_CONFIG,
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: DEFAULT_PROVIDER_CONFIG.openai.id,
        batchQueueConfig: { maxItemsPerBatch: 6, maxCharactersPerBatch: 1000 },
      },
    })
    for (let seconds = 1; seconds <= 20; seconds += 1) {
      video.currentTime = seconds
      coordinator.requestTick()
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    coordinator.stop()

    const sizes = spy.mock.calls.map((call) => (call[0] as unknown[]).length)
    spy.mockRestore()
    const firstNewSize = sizes.indexOf(6)
    expect(sizes[0]).toBe(2)
    expect(firstNewSize).toBeGreaterThan(0)
    expect(sizes.slice(firstNewSize).every((size) => size === 6)).toBe(true)
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

describe("translation coordinator when Built-in AI refuses", () => {
  let restoreSetup: (() => void) | null = null

  afterEach(() => {
    restoreSetup?.()
    restoreSetup = null
    vi.unstubAllGlobals()
  })
  /** The server's refusal, relayed from the background inside translateSubtitles' error. */
  function spentPoolError() {
    return new Error("Built-in AI quota used up", {
      cause: Object.assign(new Error("x"), { code: "HOSTED_AI_QUOTA_EXHAUSTED" }),
    })
  }

  function createVideo() {
    return {
      currentTime: 0,
      addEventListener: vi.fn<(...args: any[]) => any>(),
      removeEventListener: vi.fn<(...args: any[]) => any>(),
    }
  }

  async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  /** `trackState` keeps the player's state as the scheduler does, error badge and all. */
  async function setup({ trackState = false } = {}) {
    const fragments = Array.from({ length: 20 }, (_, i) => ({
      text: `line ${i}`,
      start: i * 2000,
      end: i * 2000 + 2000,
    }))
    const translator = await import("@/utils/subtitles/processor/translator")
    const translateSpy = vi
      .spyOn(translator, "translateSubtitles")
      .mockRejectedValue(spentPoolError())
    const configModule = await import("@/utils/config/storage")
    const configSpy = vi.spyOn(configModule, "getLocalConfig").mockResolvedValue(DEFAULT_CONFIG)
    const video = createVideo()
    const onBuiltInAiRefused = vi.fn<(error: unknown) => void>()
    let state: SubtitlesState = "idle"
    const onStateChange = vi.fn<(next: SubtitlesState) => void>((next) => {
      if (trackState) {
        state = next
      }
    })
    const coordinator = new TranslationCoordinator({
      getFragments: () => fragments,
      getVideoElement: () => video as unknown as HTMLVideoElement,
      getCurrentState: () => state,
      segmentationPipeline: null,
      onTranslated: vi.fn<(...args: any[]) => any>(),
      onStateChange,
      onBuiltInAiRefused,
      batchLimits: { maxItemsPerBatch: 2, maxCharactersPerBatch: 1000 },
    })
    restoreSetup = () => {
      coordinator.stop()
      translateSpy.mockRestore()
      configSpy.mockRestore()
    }
    return {
      coordinator,
      video,
      translateSpy,
      onBuiltInAiRefused,
      onStateChange,
      getState: () => state,
    }
  }

  it("holds translation after a refusal instead of sending batch after batch", async () => {
    const { coordinator, video, translateSpy, onBuiltInAiRefused, onStateChange } = await setup()

    coordinator.start()
    await vi.waitFor(() => expect(onBuiltInAiRefused).toHaveBeenCalledOnce())
    for (let seconds = 1; seconds <= 10; seconds += 1) {
      video.currentTime = seconds
      coordinator.requestTick()
      await flush()
    }

    expect(translateSpy).toHaveBeenCalledOnce()
    expect(onBuiltInAiRefused).toHaveBeenCalledOnce()
    // Held, no cue is on its way: the player shows no endless spinner.
    const states = onStateChange.mock.calls.map(([state]) => state)
    expect(states.slice(states.indexOf("error"))).not.toContain("loading")
  })

  it("translates the refused cues again on retry, as after switching to machine translation", async () => {
    const { coordinator, translateSpy, onBuiltInAiRefused } = await setup()

    coordinator.start()
    await vi.waitFor(() => expect(onBuiltInAiRefused).toHaveBeenCalledOnce())
    const refusedBatch = translateSpy.mock.calls[0]![0]

    translateSpy.mockImplementation((batch: any) => Promise.resolve(batch))
    coordinator.retryFailed()

    await vi.waitFor(() => expect(translateSpy.mock.calls.length).toBeGreaterThanOrEqual(2))
    expect(translateSpy.mock.calls[1]![0]).toEqual(refusedBatch)
  })

  it("retries at once when the reader switches while the refusal's error still shows", async () => {
    const { coordinator, translateSpy, onBuiltInAiRefused, getState } = await setup({
      trackState: true,
    })

    coordinator.start()
    await vi.waitFor(() => expect(onBuiltInAiRefused).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(getState()).toBe("error"))

    // The video is paused: no timeupdate comes along to pick the retry up later.
    translateSpy.mockImplementation((batch: any) => Promise.resolve(batch))
    coordinator.retryFailed()

    await vi.waitFor(() => expect(translateSpy.mock.calls.length).toBeGreaterThanOrEqual(2))
    expect(getState()).not.toBe("error")
  })

  it("tries the held cues again when the reader comes back to the tab", async () => {
    const page = Object.assign(new EventTarget(), { visibilityState: "visible" })
    vi.stubGlobal("document", page)
    const { coordinator, translateSpy, onBuiltInAiRefused } = await setup()

    coordinator.start()
    await vi.waitFor(() => expect(onBuiltInAiRefused).toHaveBeenCalledOnce())
    const refusedBatch = translateSpy.mock.calls[0]![0]

    // Off to the website to log in or upgrade: nothing has changed yet.
    page.visibilityState = "hidden"
    page.dispatchEvent(new Event("visibilitychange"))
    await flush()
    expect(translateSpy).toHaveBeenCalledOnce()

    translateSpy.mockImplementation((batch: any) => Promise.resolve(batch))
    page.visibilityState = "visible"
    page.dispatchEvent(new Event("visibilitychange"))

    await vi.waitFor(() => expect(translateSpy.mock.calls.length).toBeGreaterThanOrEqual(2))
    expect(translateSpy.mock.calls[1]![0]).toEqual(refusedBatch)

    // Stopped, it no longer listens.
    coordinator.stop()
    const calls = translateSpy.mock.calls.length
    page.dispatchEvent(new Event("visibilitychange"))
    await flush()
    expect(translateSpy).toHaveBeenCalledTimes(calls)
  })

  it("translates the refused cues again when the subtitles provider changes", async () => {
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, DEFAULT_CONFIG)
    const { coordinator, translateSpy, onBuiltInAiRefused } = await setup()

    coordinator.start()
    await vi.waitFor(() => expect(onBuiltInAiRefused).toHaveBeenCalledOnce())

    // Another setting changes: still held.
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, {
      ...DEFAULT_CONFIG,
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        batchQueueConfig: { maxItemsPerBatch: 3, maxCharactersPerBatch: 1000 },
      },
    })
    await flush()
    expect(translateSpy).toHaveBeenCalledOnce()

    translateSpy.mockImplementation((batch: any) => Promise.resolve(batch))
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, {
      ...DEFAULT_CONFIG,
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: DEFAULT_PROVIDER_CONFIG.openai.id,
      },
    })

    await vi.waitFor(() => expect(translateSpy.mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it("keeps going after a failure that is not a refusal", async () => {
    const { coordinator, video, translateSpy, onBuiltInAiRefused } = await setup()
    translateSpy.mockRejectedValue(new Error("Failed to fetch"))

    coordinator.start()
    await vi.waitFor(() => expect(translateSpy).toHaveBeenCalled())
    video.currentTime = 5
    coordinator.requestTick()
    await vi.waitFor(() => expect(translateSpy.mock.calls.length).toBeGreaterThan(1))

    expect(onBuiltInAiRefused).not.toHaveBeenCalled()
  })
})
