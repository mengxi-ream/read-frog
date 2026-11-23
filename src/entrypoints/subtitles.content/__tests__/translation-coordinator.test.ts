import type { SubtitlesFragment, SubtitlesState } from "@/utils/subtitles/types"
import { afterEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { configSchema } from "@/types/config/config"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { FAILED_BATCH_RETRY_MS } from "@/utils/constants/subtitles"
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

  it("keeps a failed cue's error up through the gap before the next, and shows that one's own", () => {
    const onStateChange = vi.fn<(...args: any[]) => any>()
    const fragments = [
      { text: "hello", start: 0, end: 1000 },
      { text: "world", start: 2000, end: 3000 },
      { text: "again", start: 4000, end: 5000 },
    ]
    const coordinator = new TranslationCoordinator({
      getFragments: () => fragments,
      getVideoElement: () => ({ currentTime: 0.5 }) as HTMLVideoElement,
      getCurrentState: () => "idle",
      segmentationPipeline: null,
      onTranslated: vi.fn<(...args: any[]) => any>(),
      onStateChange,
    })
    const offline = { error: new Error("Failed to fetch"), waiting: true }
    ;(coordinator as any).failedCues = new Map([
      [0, offline],
      [2000, offline],
      [4000, { error: new Error("Internal server error"), waiting: true }],
    ])

    ;(coordinator as any).updateLoadingStateAt(500, fragments)
    ;(coordinator as any).updateLoadingStateAt(1500, fragments)
    ;(coordinator as any).updateLoadingStateAt(2500, fragments)
    ;(coordinator as any).updateLoadingStateAt(4500, fragments)

    // Not taken down in the gap, and not shown twice; the third cue failed on its own.
    expect(onStateChange.mock.calls).toEqual([
      ["error", { message: "Failed to fetch", persistent: true }],
      ["error", { message: "Internal server error", persistent: true }],
    ])

    // A batch came back: in a gap, the error goes.
    ;(coordinator as any).failedCues.clear()
    ;(coordinator as any).updateLoadingStateAt(3500, fragments)
    expect(onStateChange).toHaveBeenLastCalledWith("idle")
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
    // The whole look-ahead window at once, in full batches.
    expect(spy.mock.calls.map(([batch]) => batch.length)).toEqual([4, 2])

    coordinator.stop()
    const firstCall = spy.mock.calls[0]!
    const batch = firstCall[0] as Array<{ text: string; start: number; end: number }>
    resolveTranslate(batch.map((f) => ({ ...f, translation: `t:${f.text}` })))
    await Promise.resolve()
    await Promise.resolve()

    // In-flight calls may finish, but stop must not chain another nearby batch.
    expect(spy).toHaveBeenCalledTimes(2)
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

  it("sends the recut cues, not the stale one, after a batch fails across a recut", async () => {
    let fragments = [
      { text: "hello world", start: 0, end: 2000 },
      { text: "next", start: 2000, end: 3000 },
    ]
    const onTranslated = vi.fn<(...args: any[]) => any>()
    const onStateChange = vi.fn<(...args: any[]) => any>()

    const translator = await import("@/utils/subtitles/processor/translator")
    const failRequests: Array<(error: Error) => void> = []
    const spy = vi.spyOn(translator, "translateSubtitles").mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          failRequests.push(reject)
        }),
    )

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
    // Recut mid-request: the original cue is gone.
    fragments = [
      { text: "hello", start: 0, end: 1000 },
      { text: "world", start: 1000, end: 2000 },
      { text: "next", start: 2000, end: 3000 },
    ]
    failRequests.splice(0).forEach((fail) => fail(new Error("translate failed")))
    await vi.waitFor(() => expect(spy.mock.calls.length).toBeGreaterThan(1))

    // The recut cues are new ones, with nothing failed: they go out at once, never the stale
    // one. The cue that failed as it was waits out its 10 s.
    const resent = spy.mock.calls.slice(1).flatMap(([batch]) => batch)
    expect(resent.map((f) => f.text)).toEqual(["hello", "world"])
    // A failed batch publishes nothing, stale or not; the cue on screen is a new one.
    expect(onTranslated).not.toHaveBeenCalled()
    expect(onStateChange).not.toHaveBeenCalledWith("error", expect.anything())

    coordinator.stop()
    spy.mockRestore()
  })
})

let restoreSetup: (() => void) | null = null

afterEach(() => {
  restoreSetup?.()
  restoreSetup = null
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** The server's refusal, relayed from the background inside translateSubtitles' error. */
function spentPoolError() {
  return new Error("Built-in AI quota used up", {
    cause: Object.assign(new Error("x"), { code: "HOSTED_AI_QUOTA_EXHAUSTED" }),
  })
}

/** OpenAI's answer for an account with no balance, relayed from the background. */
function noBalanceError() {
  return new Error("You exceeded your current quota", {
    cause: Object.assign(new Error("You exceeded your current quota"), {
      name: "AI_APICallError",
      statusCode: 429,
      responseBody: JSON.stringify({
        error: { type: "insufficient_quota", code: "insufficient_quota" },
      }),
    }),
  })
}

/** Built-in AI's server refusing a plan the model is not on, kind and all, as relayed. */
function planDeniedError() {
  return new Error("Ultra required", {
    cause: Object.assign(new Error("Ultra required"), {
      code: "HOSTED_AI_TIER_RESTRICTED",
      kind: "access-denied",
      isRetryable: false,
    }),
  })
}

/** A provider's answer with this status, relayed from the background. */
function relayedStatusError(statusCode: number, message: string) {
  return new Error(message, {
    cause: Object.assign(new Error(message), { name: "AI_APICallError", statusCode }),
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
async function setup({ trackState = false, machinePlaceholder = false } = {}) {
  const fragments = Array.from({ length: 20 }, (_, i) => ({
    text: `line ${i}`,
    start: i * 2000,
    end: i * 2000 + 2000,
  }))
  const translator = await import("@/utils/subtitles/processor/translator")
  const translateSpy = vi
    .spyOn(translator, "translateSubtitles")
    .mockRejectedValue(spentPoolError())
  const machineSpy = vi
    .spyOn(translator, "translateSubtitleWithMachine")
    .mockImplementation(async (text) => `mt:${text}`)
  const video = createVideo()
  const onBuiltInAiRefused = vi.fn<(error: unknown) => void>()
  const onTranslated = vi.fn<(fragments: SubtitlesFragment[]) => void>()
  const onMachineTranslationsDropped = vi.fn<() => void>()
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
    onTranslated,
    onStateChange,
    onBuiltInAiRefused,
    onMachineTranslationsDropped,
    machinePlaceholder,
    batchLimits: { maxItemsPerBatch: 2, maxCharactersPerBatch: 1000 },
  })
  restoreSetup = () => {
    coordinator.stop()
    translateSpy.mockRestore()
    machineSpy.mockRestore()
  }
  return {
    coordinator,
    video,
    translateSpy,
    machineSpy,
    onBuiltInAiRefused,
    onTranslated,
    onMachineTranslationsDropped,
    onStateChange,
    getState: () => state,
  }
}

/** Every batch sent so far, in order. */
function sentBatches(translateSpy: { mock: { calls: unknown[][] } }) {
  return translateSpy.mock.calls.map(([batch]) => batch as SubtitlesFragment[])
}

describe("translation coordinator when batches fail", () => {
  it("holds translation after a refusal instead of sending batch after batch", async () => {
    const { coordinator, video, translateSpy, onBuiltInAiRefused, onStateChange } = await setup()

    coordinator.start()
    await vi.waitFor(() => expect(onBuiltInAiRefused).toHaveBeenCalledOnce())
    await flush()
    const sent = translateSpy.mock.calls.length
    for (let seconds = 1; seconds <= 10; seconds += 1) {
      video.currentTime = seconds
      coordinator.requestTick()
      await flush()
    }

    expect(translateSpy).toHaveBeenCalledTimes(sent)
    // Every batch of the window was refused, and the reader is asked once.
    expect(onBuiltInAiRefused).toHaveBeenCalledOnce()
    // Held, no cue is on its way: the player shows no endless spinner.
    const states = onStateChange.mock.calls.map(([state]) => state)
    expect(states.slice(states.indexOf("error"))).not.toContain("loading")
  })

  it("translates the refused cues again on retry, as after switching to machine translation", async () => {
    const { coordinator, translateSpy, onBuiltInAiRefused } = await setup()

    coordinator.start()
    await vi.waitFor(() => expect(onBuiltInAiRefused).toHaveBeenCalledOnce())
    await flush()
    const refused = sentBatches(translateSpy)

    translateSpy.mockImplementation((batch: any) => Promise.resolve(batch))
    coordinator.retryFailed()

    await vi.waitFor(() => expect(translateSpy.mock.calls.length).toBeGreaterThan(refused.length))
    expect(sentBatches(translateSpy).slice(refused.length)).toEqual(refused)
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
    await flush()
    const refused = sentBatches(translateSpy)

    // Off to the website to log in or upgrade: nothing has changed yet.
    page.visibilityState = "hidden"
    page.dispatchEvent(new Event("visibilitychange"))
    await flush()
    expect(translateSpy).toHaveBeenCalledTimes(refused.length)

    translateSpy.mockImplementation((batch: any) => Promise.resolve(batch))
    page.visibilityState = "visible"
    page.dispatchEvent(new Event("visibilitychange"))

    await vi.waitFor(() => expect(translateSpy.mock.calls.length).toBeGreaterThan(refused.length))
    expect(sentBatches(translateSpy)[refused.length]).toEqual(refused[0])

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
    await flush()
    const sent = translateSpy.mock.calls.length

    // Another setting changes: still held.
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, {
      ...DEFAULT_CONFIG,
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        batchQueueConfig: { maxItemsPerBatch: 3, maxCharactersPerBatch: 1000 },
      },
    })
    await flush()
    expect(translateSpy).toHaveBeenCalledTimes(sent)

    translateSpy.mockImplementation((batch: any) => Promise.resolve(batch))
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, {
      ...DEFAULT_CONFIG,
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: DEFAULT_PROVIDER_CONFIG.openai.id,
      },
    })

    await vi.waitFor(() => expect(translateSpy.mock.calls.length).toBeGreaterThan(sent))
  })

  it("translates the held cues again when the reader picks another Built-in AI model", async () => {
    const luna = { ...DEFAULT_CONFIG.videoSubtitles, providerId: "read-frog-ai:gpt-6-luna" }
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, {
      ...DEFAULT_CONFIG,
      videoSubtitles: luna,
    })
    const { coordinator, translateSpy, onStateChange } = await setup()
    // The model the server cannot run right now, as the background relays it.
    translateSpy.mockRejectedValue(
      new Error("GPT-6 Luna can't run right now. Try Claude Haiku instead.", {
        cause: Object.assign(new Error("x"), {
          code: "HOSTED_AI_MODEL_UNAVAILABLE",
          kind: "access-denied",
        }),
      }),
    )

    coordinator.start()
    await vi.waitFor(() =>
      expect(onStateChange).toHaveBeenCalledWith(
        "error",
        expect.objectContaining({ persistent: true }),
      ),
    )
    await flush()
    const sent = translateSpy.mock.calls.length

    // The model is part of the provider id, so another model is another provider.
    translateSpy.mockImplementation((batch: any) => Promise.resolve(batch))
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, {
      ...DEFAULT_CONFIG,
      videoSubtitles: { ...luna, providerId: "read-frog-ai:claude-haiku-5-5" },
    })

    await vi.waitFor(() => expect(translateSpy.mock.calls.length).toBeGreaterThan(sent))
  })

  it("sends a batch that fails alone again as another comes back, saying nothing off screen", async () => {
    const { coordinator, translateSpy, onTranslated, onStateChange } = await setup()
    let failed = false
    translateSpy.mockImplementation((batch: any) => {
      if (batch[0].start === 4000 && !failed) {
        failed = true
        return Promise.reject(new Error("timed out"))
      }
      return Promise.resolve(batch.map((f: any) => ({ ...f, translation: `t:${f.text}` })))
    })

    coordinator.start()
    await flush()

    expect(sentBatches(translateSpy).filter((batch) => batch[0]!.start === 4000)).toHaveLength(2)
    expect(onTranslated).toHaveBeenCalledWith([
      expect.objectContaining({ start: 4000, translation: "t:line 2" }),
      expect.objectContaining({ start: 6000, translation: "t:line 3" }),
    ])
    expect(onStateChange).not.toHaveBeenCalledWith("error", expect.anything())
  })

  it("shows the error while the cue on screen has failed, and goes on as playback moves", async () => {
    const { coordinator, video, translateSpy, onBuiltInAiRefused, onStateChange } = await setup()
    translateSpy.mockRejectedValue(new Error("Insufficient Balance"))

    coordinator.start()
    await vi.waitFor(() =>
      expect(onStateChange).toHaveBeenCalledWith("error", {
        message: "Insufficient Balance",
        persistent: true,
      }),
    )
    await flush()
    const sent = translateSpy.mock.calls.length
    video.currentTime = 20
    coordinator.requestTick()
    await flush()

    // Not held: the cues playback brings into the window go out, the failed ones wait.
    expect(
      sentBatches(translateSpy)
        .slice(sent)
        .map((batch) => batch[0]!.start),
    ).toEqual([32_000, 36_000])
    expect(onBuiltInAiRefused).not.toHaveBeenCalled()
    // The cue on screen then has failed too: the error stays up, shown once.
    expect(onStateChange.mock.calls.filter(([state]) => state === "error")).toHaveLength(1)
  })

  it.each([
    ["an OpenAI account with no balance", noBalanceError(), "You exceeded your current quota"],
    ["Built-in AI refusing the plan", planDeniedError(), "Ultra required"],
    [
      "a wrong key",
      relayedStatusError(401, "Incorrect API key provided"),
      "Incorrect API key provided",
    ],
    [
      "an empty DeepSeek balance",
      relayedStatusError(402, "Insufficient Balance"),
      "Insufficient Balance",
    ],
    ["no permission", relayedStatusError(403, "Forbidden"), "Forbidden"],
    [
      "a wrong model",
      relayedStatusError(404, "The model does not exist"),
      "The model does not exist",
    ],
  ])(
    "holds at the first failure every later batch would repeat: %s",
    async (_case, error, message) => {
      const { coordinator, translateSpy, onBuiltInAiRefused, onStateChange } = await setup()
      // The first batch fails while the others are still on their way.
      translateSpy.mockImplementation((batch: any) =>
        batch[0].start === 0 ? Promise.reject(error) : new Promise(() => {}),
      )

      coordinator.start()

      await vi.waitFor(() =>
        expect(onStateChange).toHaveBeenCalledWith("error", { message, persistent: true }),
      )
      // None of them asks the reader to log in or upgrade.
      expect(onBuiltInAiRefused).not.toHaveBeenCalled()
    },
  )

  it.each([
    ["a bad request", relayedStatusError(400, "Bad request"), "Bad request"],
    ["a rate limit", relayedStatusError(429, "Rate limit reached"), "Rate limit reached"],
    ["a server error", relayedStatusError(500, "Internal server error"), "Internal server error"],
    ["a timeout", new Error("timed out"), "timed out"],
  ])(
    "shows an error a later batch may get past on the cue on screen, and tries again 10 s on: %s",
    async (_case, error, message) => {
      vi.useFakeTimers({ now: 0 })
      const { coordinator, translateSpy, onBuiltInAiRefused, onStateChange } = await setup()
      let failed = false
      translateSpy.mockImplementation((batch: any) => {
        if (batch[0].start === 0 && !failed) {
          failed = true
          return Promise.reject(error)
        }
        return new Promise(() => {})
      })
      const sendsOfFirst = () =>
        sentBatches(translateSpy).filter((batch) => batch[0]!.start === 0).length

      coordinator.start()
      await vi.advanceTimersByTimeAsync(0)
      expect(onStateChange).toHaveBeenCalledWith("error", { message, persistent: true })

      await vi.advanceTimersByTimeAsync(FAILED_BATCH_RETRY_MS - 1)
      expect(sendsOfFirst()).toBe(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(sendsOfFirst()).toBe(2)
      // Not held: nothing asks the reader to act.
      expect(onBuiltInAiRefused).not.toHaveBeenCalled()
    },
  )

  it("sends a failed cue again as its timer fires, though the clock reads a little short", async () => {
    vi.useFakeTimers({ now: 0 })
    const { coordinator, translateSpy } = await setup()
    let failed = false
    translateSpy.mockImplementation((batch: any) => {
      if (batch[0].start === 0 && !failed) {
        failed = true
        return Promise.reject(new Error("timed out"))
      }
      return new Promise(() => {})
    })
    const sendsOfFirst = () =>
      sentBatches(translateSpy).filter((batch) => batch[0]!.start === 0).length

    coordinator.start()
    await vi.advanceTimersByTimeAsync(FAILED_BATCH_RETRY_MS - 1)
    expect(sendsOfFirst()).toBe(1)

    // Firefox can fire a timer a little ahead of Date.now(). The video stands still and no
    // batch comes back: this timer is all there is to send the cue again.
    vi.setSystemTime(Date.now() - 1)
    await vi.advanceTimersByTimeAsync(1)
    expect(sendsOfFirst()).toBe(2)
  })

  it("takes lines that failed while the rest of their batch came back as failed", async () => {
    vi.useFakeTimers({ now: 0 })
    const { coordinator, video, translateSpy, onTranslated, onStateChange, getState } = await setup(
      { trackState: true },
    )
    // Line 1 went in a background request that failed, line 0 in one that came back: the
    // translator gives back line 1 blank, and says it failed.
    let failed = false
    translateSpy.mockImplementation(
      (batch: any, _context: any, _config: any, onLinesFailed: any) => {
        if (batch[0].start === 0 && !failed) {
          failed = true
          onLinesFailed?.([batch[1]], new Error("Internal server error"))
          return Promise.resolve([
            { ...batch[0], translation: "t:line 0" },
            { ...batch[1], translation: "" },
          ])
        }
        if (batch[0].start === 2000) {
          return Promise.resolve(batch.map((f: any) => ({ ...f, translation: `t:${f.text}` })))
        }
        return new Promise(() => {})
      },
    )
    const sendsOfLine1 = () =>
      sentBatches(translateSpy).filter((batch) => batch.some((f) => f.start === 2000)).length

    coordinator.start()
    await vi.advanceTimersByTimeAsync(0)
    // Not taken as translated: only line 0 shows.
    expect(onTranslated.mock.calls).toEqual([
      [[expect.objectContaining({ start: 0, translation: "t:line 0" })]],
    ])

    // Line 1 on screen shows the error, as a cue whose whole batch failed does.
    video.currentTime = 2.5
    coordinator.requestTick()
    expect(onStateChange).toHaveBeenCalledWith("error", {
      message: "Internal server error",
      persistent: true,
    })

    // And it goes again 10 s on.
    await vi.advanceTimersByTimeAsync(FAILED_BATCH_RETRY_MS - 1)
    expect(sendsOfLine1()).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(sendsOfLine1()).toBe(2)
    expect(onTranslated).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ start: 2000, translation: "t:line 1" })]),
    )
    expect(getState()).toBe("idle")
  })

  it("holds when lines fail while the rest came back, with an error every batch would repeat", async () => {
    const { coordinator, translateSpy, onTranslated, onStateChange } = await setup()
    // Line 0 came from the cache; line 1 went to the provider, which turned the key down.
    translateSpy.mockImplementation(
      (batch: any, _context: any, _config: any, onLinesFailed: any) => {
        if (batch[0].start === 0) {
          onLinesFailed?.([batch[1]], relayedStatusError(401, "Incorrect API key provided"))
          return Promise.resolve([
            { ...batch[0], translation: "t:line 0" },
            { ...batch[1], translation: "" },
          ])
        }
        return new Promise(() => {})
      },
    )

    coordinator.start()
    await flush()

    expect(onTranslated.mock.calls).toEqual([
      [[expect.objectContaining({ start: 0, translation: "t:line 0" })]],
    ])
    expect(onStateChange).toHaveBeenCalledWith("error", {
      message: "Incorrect API key provided",
      persistent: true,
    })
    // Held: nothing more goes out.
    const sent = translateSpy.mock.calls.length
    coordinator.requestTick()
    expect(translateSpy).toHaveBeenCalledTimes(sent)
  })

  it("takes a failed cue's error down as a batch comes back, and sends the cue again", async () => {
    const { coordinator, translateSpy, getState } = await setup({ trackState: true })
    const answers = new Map<number, { ok: () => void; fail: (error: Error) => void }>()
    translateSpy.mockImplementation(
      (batch: any) =>
        new Promise((resolve, reject) => {
          answers.set(batch[0].start, {
            ok: () => resolve(batch.map((f: any) => ({ ...f, translation: `t:${f.text}` }))),
            fail: reject,
          })
        }),
    )
    const sendsOfFirst = () =>
      sentBatches(translateSpy).filter((batch) => batch[0]!.start === 0).length

    coordinator.start()
    expect(getState()).toBe("loading")

    answers.get(0)!.fail(new Error("timed out"))
    await flush()
    expect(getState()).toBe("error")
    // Waiting out its 10 s.
    expect(sendsOfFirst()).toBe(1)

    // The provider works: the failed cue goes at once, and shows as on its way.
    answers.get(4000)!.ok()
    await flush()
    expect(sendsOfFirst()).toBe(2)
    expect(getState()).toBe("loading")
  })

  it("sends a whole window that failed at once again 10 s on, and takes the error down", async () => {
    vi.useFakeTimers({ now: 0 })
    const { coordinator, translateSpy, onTranslated, onStateChange, getState } = await setup({
      trackState: true,
    })
    // The network drops as the window goes out, and is back long before it goes again.
    let down = true
    translateSpy.mockImplementation((batch: any) =>
      down
        ? Promise.reject(new Error("Failed to fetch"))
        : Promise.resolve(batch.map((f: any) => ({ ...f, translation: `t:${f.text}` }))),
    )

    coordinator.start()
    const wave = translateSpy.mock.calls.length
    await vi.advanceTimersByTimeAsync(0)
    down = false
    expect(getState()).toBe("error")

    // Not one batch more while they wait, however many failed.
    await vi.advanceTimersByTimeAsync(FAILED_BATCH_RETRY_MS - 1)
    expect(translateSpy).toHaveBeenCalledTimes(wave)

    await vi.advanceTimersByTimeAsync(1)
    expect(translateSpy).toHaveBeenCalledTimes(wave * 2)
    expect(onTranslated).toHaveBeenCalledWith([
      expect.objectContaining({ start: 0, translation: "t:line 0" }),
      expect.objectContaining({ start: 2000, translation: "t:line 1" }),
    ])
    expect(getState()).toBe("idle")
    expect(onStateChange.mock.calls.filter(([state]) => state === "error")).toHaveLength(1)
  })

  it("goes on through failures a later batch may get past, however many in a row", async () => {
    vi.useFakeTimers({ now: 0 })
    const { coordinator, translateSpy, onTranslated, onStateChange, getState } = await setup({
      trackState: true,
    })
    let failing = true
    translateSpy.mockImplementation((batch: any) =>
      failing
        ? Promise.reject(new Error("Internal server error"))
        : Promise.resolve(batch.map((f: any) => ({ ...f, translation: `t:${f.text}` }))),
    )

    coordinator.start()
    // Ten tries in a row, 10 s apart, all failing: still trying, the error up all along.
    await vi.advanceTimersByTimeAsync(9 * FAILED_BATCH_RETRY_MS)
    expect(sentBatches(translateSpy).filter((batch) => batch[0]!.start === 0)).toHaveLength(10)
    expect(getState()).toBe("error")
    expect(onStateChange.mock.calls.filter(([state]) => state === "error")).toHaveLength(1)

    failing = false
    await vi.advanceTimersByTimeAsync(FAILED_BATCH_RETRY_MS)
    expect(onTranslated).toHaveBeenCalledWith([
      expect.objectContaining({ start: 0, translation: "t:line 0" }),
      expect.objectContaining({ start: 2000, translation: "t:line 1" }),
    ])
    expect(getState()).toBe("idle")
  })
})

describe("translation coordinator through an outage", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * The background queue through an outage: it tries a batch as it is sent, then 1 s and
   * 3 s after (two retries, the delay doubling), and gives up after the third try fails.
   */
  function answerThroughOutage(outageEndsAtMs: number) {
    const sentAt: { start: number; at: number }[] = []
    const answer = (batch: SubtitlesFragment[]) =>
      new Promise<SubtitlesFragment[]>((resolve, reject) => {
        const now = Date.now()
        sentAt.push({ start: batch[0]!.start, at: now })
        const getsThroughAfter = [0, 1000, 3000].find((delay) => now + delay >= outageEndsAtMs)
        if (getsThroughAfter === undefined) {
          setTimeout(() => reject(new Error("Failed to fetch")), 3000)
        } else {
          setTimeout(
            () => resolve(batch.map((f) => ({ ...f, translation: `t:${f.text}` }))),
            getsThroughAfter,
          )
        }
      })
    return { answer, sendsOf: (start: number) => sentAt.filter((send) => send.start === start) }
  }

  it("shows the error 3 s into an outage of 8 s, and translates on as the batches go again", async () => {
    vi.useFakeTimers({ now: 0 })
    const { coordinator, translateSpy, onTranslated, onStateChange, getState } = await setup({
      trackState: true,
    })
    const queue = answerThroughOutage(8000)
    translateSpy.mockImplementation(queue.answer)

    // The video stands still: no new batch comes back to bring the failed ones.
    coordinator.start()
    await vi.advanceTimersByTimeAsync(2999)
    expect(getState()).toBe("loading")
    await vi.advanceTimersByTimeAsync(1)
    expect(onStateChange).toHaveBeenCalledWith("error", {
      message: "Failed to fetch",
      persistent: true,
    })

    await vi.advanceTimersByTimeAsync(20_000)
    // Failed at 3 s, the batch goes again at 13 s, after the outage ended at 8 s.
    expect(queue.sendsOf(0).map((send) => send.at)).toEqual([0, 13_000])
    expect(onTranslated).toHaveBeenCalledWith([
      expect.objectContaining({ start: 0, translation: "t:line 0" }),
      expect.objectContaining({ start: 2000, translation: "t:line 1" }),
    ])
    expect(getState()).toBe("idle")
  })

  it("keeps the error up through a long outage, trying every 13 s, and goes on as it ends", async () => {
    vi.useFakeTimers({ now: 0 })
    const { coordinator, translateSpy, onTranslated, onStateChange, getState } = await setup({
      trackState: true,
    })
    const queue = answerThroughOutage(60_000)
    translateSpy.mockImplementation(queue.answer)

    coordinator.start()
    await vi.advanceTimersByTimeAsync(66_000)

    // Each try fails 3 s after it goes, and the next goes 10 s after that. The one at 65 s,
    // after the outage, gets through. Never held, and the error shown once, not flickering.
    expect(queue.sendsOf(0).map((send) => send.at)).toEqual([
      0, 13_000, 26_000, 39_000, 52_000, 65_000,
    ])
    expect(onStateChange.mock.calls.filter(([state]) => state === "error")).toHaveLength(1)
    expect(onTranslated).toHaveBeenCalledWith([
      expect.objectContaining({ start: 0, translation: "t:line 0" }),
      expect.objectContaining({ start: 2000, translation: "t:line 1" }),
    ])
    expect(getState()).toBe("idle")
  })

  it("tries a batch only it fails every 10 s, its error up only while its cues show", async () => {
    vi.useFakeTimers({ now: 0 })
    const { coordinator, video, translateSpy, onStateChange, getState } = await setup({
      trackState: true,
    })
    // Such as a content filter turning down one of its lines: a 400, which the queue does
    // not try again, back after 300 ms. The other batches come back at once.
    translateSpy.mockImplementation((batch: any) =>
      batch[0].start === 4000
        ? new Promise((_resolve, reject) =>
            setTimeout(() => reject(relayedStatusError(400, "Content filtered")), 300),
          )
        : Promise.resolve(batch.map((f: any) => ({ ...f, translation: `t:${f.text}` }))),
    )

    coordinator.start()
    await vi.advanceTimersByTimeAsync(20_700)
    // Failed at 0.3 s, it goes again at 10.3 s and 20.6 s; the rest of the video goes on.
    expect(sentBatches(translateSpy).filter((batch) => batch[0]!.start === 4000)).toHaveLength(3)
    expect(onStateChange).not.toHaveBeenCalledWith("error", expect.anything())

    // Its cues come on screen.
    video.currentTime = 4
    coordinator.requestTick()
    expect(onStateChange).toHaveBeenCalledWith("error", {
      message: "Content filtered",
      persistent: true,
    })

    // The next cue is translated: the error goes.
    video.currentTime = 8
    coordinator.requestTick()
    expect(getState()).toBe("idle")
  })
})

describe("translation coordinator sending", () => {
  /** Each batch as the indexes of its cues, which start every 2 s. */
  function batchIndexes(batches: SubtitlesFragment[][]) {
    return batches.map((batch) => batch.map((fragment) => fragment.start / 2000))
  }

  it("sends the whole look-ahead window at once, then the new place right after a seek", async () => {
    const { coordinator, video, translateSpy } = await setup()
    // The AI never answers: nothing waits on it.
    translateSpy.mockImplementation(() => new Promise(() => {}))

    coordinator.start()
    expect(batchIndexes(sentBatches(translateSpy))).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
      [8, 9],
      [10, 11],
      [12, 13],
      [14, 15],
    ])

    video.currentTime = 34
    coordinator.requestTick()
    expect(batchIndexes(sentBatches(translateSpy).slice(8))).toEqual([
      [16, 17],
      [18, 19],
    ])
  })

  it("sends for the new place as a seek starts, while the player still buffers it", async () => {
    const { coordinator, video, translateSpy } = await setup()
    translateSpy.mockImplementation(() => new Promise(() => {}))

    coordinator.start()
    const onSeeking = video.addEventListener.mock.calls.find(([type]) => type === "seeking")?.[1]
    expect(onSeeking).toBeTypeOf("function")

    video.currentTime = 34
    onSeeking()
    expect(batchIndexes(sentBatches(translateSpy).slice(8))).toEqual([
      [16, 17],
      [18, 19],
    ])
  })
})

describe("translation coordinator machine translations", () => {
  it("puts one on a cue about to show while its AI translation is on the way", async () => {
    const { coordinator, video, translateSpy, machineSpy, onTranslated } = await setup({
      machinePlaceholder: true,
    })
    translateSpy.mockImplementation(() => new Promise(() => {}))

    coordinator.start()
    // The cue on screen; the next one, 2 s away, is not near enough yet.
    expect(machineSpy.mock.calls).toEqual([["line 0"]])
    await vi.waitFor(() =>
      expect(onTranslated).toHaveBeenCalledWith([
        { text: "line 0", start: 0, end: 2000, translation: "mt:line 0", placeholder: "machine" },
      ]),
    )

    video.currentTime = 0.6
    coordinator.requestTick()
    video.currentTime = 0.8
    coordinator.requestTick()
    // 1.5 s ahead, and once a cue.
    expect(machineSpy.mock.calls).toEqual([["line 0"], ["line 1"]])
  })

  it("looks further ahead at a higher playback rate", async () => {
    const { coordinator, video, translateSpy, machineSpy } = await setup({
      machinePlaceholder: true,
    })
    translateSpy.mockImplementation(() => new Promise(() => {}))
    Object.assign(video, { playbackRate: 2 })

    coordinator.start()

    expect(machineSpy.mock.calls).toEqual([["line 0"], ["line 1"]])
  })

  it("asks for none once the AI translation is in", async () => {
    const { coordinator, video, translateSpy, machineSpy } = await setup({
      machinePlaceholder: true,
    })
    translateSpy.mockImplementation((batch: any) => Promise.resolve(batch))

    coordinator.start()
    await flush()
    machineSpy.mockClear()
    for (let seconds = 1; seconds <= 20; seconds += 1) {
      video.currentTime = seconds
      coordinator.requestTick()
      await flush()
    }

    expect(machineSpy).not.toHaveBeenCalled()
  })

  it("asks for none once the reader switches Microsoft Translator off mid-video", async () => {
    const { coordinator, video, translateSpy, machineSpy } = await setup({
      machinePlaceholder: true,
    })
    translateSpy.mockImplementation(() => new Promise(() => {}))
    coordinator.start()
    expect(machineSpy.mock.calls).toEqual([["line 0"]])

    // The options let no one switch off a provider a feature uses: those moved off it first.
    const google = DEFAULT_PROVIDER_CONFIG["google-translate"].id
    const { selectionToolbar } = DEFAULT_CONFIG
    const microsoftOff = {
      ...DEFAULT_CONFIG,
      providersConfig: DEFAULT_CONFIG.providersConfig.map((provider) =>
        provider.provider === "microsoft-translate" ? { ...provider, enabled: false } : provider,
      ),
      pageTranslation: { ...DEFAULT_CONFIG.pageTranslation, providerId: google },
      inputTranslation: { ...DEFAULT_CONFIG.inputTranslation, providerId: google },
      selectionToolbar: {
        ...selectionToolbar,
        features: {
          ...selectionToolbar.features,
          translate: { ...selectionToolbar.features.translate, providerId: google },
        },
      },
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: DEFAULT_PROVIDER_CONFIG.openai.id,
      },
    }
    expect(configSchema.safeParse(microsoftOff).success).toBe(true)
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, microsoftOff)
    await flush()

    // Line 1 is 1 s away now, near enough for one.
    video.currentTime = 1
    coordinator.requestTick()
    expect(machineSpy.mock.calls).toEqual([["line 0"]])
  })

  it("asks for none for a translation service, which is fast on its own", async () => {
    const { coordinator, translateSpy, machineSpy } = await setup()
    translateSpy.mockImplementation(() => new Promise(() => {}))

    coordinator.start()
    await flush()

    expect(machineSpy).not.toHaveBeenCalled()
  })

  it("takes them down when translation holds, and drops one that comes back after", async () => {
    const {
      coordinator,
      video,
      translateSpy,
      machineSpy,
      onTranslated,
      onMachineTranslationsDropped,
    } = await setup({ machinePlaceholder: true })
    let answerMachine!: (translation: string) => void
    machineSpy.mockImplementation(
      () =>
        new Promise((resolve) => {
          answerMachine = resolve
        }),
    )

    // Every batch is refused.
    coordinator.start()
    await vi.waitFor(() => expect(onMachineTranslationsDropped).toHaveBeenCalledOnce())
    answerMachine("mt:line 0")
    await flush()

    const published = onTranslated.mock.calls.flatMap(([fragments]) => fragments)
    expect(published.some((fragment) => fragment.placeholder === "machine")).toBe(false)

    // Held: none asked for as playback goes on.
    machineSpy.mockClear()
    video.currentTime = 1
    coordinator.requestTick()
    expect(machineSpy).not.toHaveBeenCalled()

    // Retried: the cue on screen gets one again while the AI's is on the way.
    translateSpy.mockImplementation(() => new Promise(() => {}))
    coordinator.retryFailed()
    expect(machineSpy).toHaveBeenCalledWith("line 0")
  })
})
