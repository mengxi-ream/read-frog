import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DOMAudioPlaybackController } from "../dom-audio-controller"

const createObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL")
const revokeObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL")

function installFakeAudio() {
  const createObjectURLMock = vi.fn(() => `blob:tts-test-${createObjectURLMock.mock.calls.length}`)
  const revokeObjectURLMock = vi.fn()

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURLMock,
  })
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURLMock,
  })

  class FakeAudio {
    static instances: FakeAudio[] = []

    onended: (() => void) | null = null
    onerror: (() => void) | null = null
    play = vi.fn().mockResolvedValue(undefined)
    pause = vi.fn()
    removeAttribute = vi.fn()
    load = vi.fn()

    constructor(readonly src: string) {
      FakeAudio.instances.push(this)
    }
  }

  vi.stubGlobal("Audio", FakeAudio)

  return {
    FakeAudio,
    createObjectURLMock,
    revokeObjectURLMock,
  }
}

describe("dom audio playback controller", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (createObjectURLDescriptor) {
      Object.defineProperty(URL, "createObjectURL", createObjectURLDescriptor)
    }
    else {
      delete (URL as { createObjectURL?: unknown }).createObjectURL
    }

    if (revokeObjectURLDescriptor) {
      Object.defineProperty(URL, "revokeObjectURL", revokeObjectURLDescriptor)
    }
    else {
      delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL
    }
  })

  it("plays audio and cleans up object URLs after playback ends", async () => {
    const { FakeAudio, revokeObjectURLMock } = installFakeAudio()
    const controller = new DOMAudioPlaybackController("playback failed")

    const playbackPromise = controller.play({
      requestId: "req-1",
      audioBase64: "ZmFrZQ==",
      contentType: "audio/mpeg",
    })

    expect(FakeAudio.instances).toHaveLength(1)
    expect(FakeAudio.instances[0]!.play).toHaveBeenCalled()

    FakeAudio.instances[0]!.onended?.()

    await expect(playbackPromise).resolves.toEqual({ ok: true })
    expect(FakeAudio.instances[0]!.pause).toHaveBeenCalled()
    expect(FakeAudio.instances[0]!.removeAttribute).toHaveBeenCalledWith("src")
    expect(FakeAudio.instances[0]!.load).toHaveBeenCalled()
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:tts-test-1")
  })

  it("does not stop playback when requestId does not match", async () => {
    const { FakeAudio } = installFakeAudio()
    const controller = new DOMAudioPlaybackController("playback failed")

    const playbackPromise = controller.play({
      requestId: "req-active",
      audioBase64: "ZmFrZQ==",
      contentType: "audio/mpeg",
    })

    expect(controller.stop({ requestId: "req-other" })).toBe(false)
    expect(FakeAudio.instances[0]!.pause).not.toHaveBeenCalled()

    expect(controller.stop({ requestId: "req-active" })).toBe(true)

    await expect(playbackPromise).resolves.toEqual({ ok: false, reason: "stopped" })
    expect(FakeAudio.instances[0]!.pause).toHaveBeenCalled()
  })

  it("interrupts the previous playback when a new request starts", async () => {
    const { FakeAudio } = installFakeAudio()
    const controller = new DOMAudioPlaybackController("playback failed")

    const firstPlayback = controller.play({
      requestId: "req-1",
      audioBase64: "ZmFrZQ==",
      contentType: "audio/mpeg",
    })
    const secondPlayback = controller.play({
      requestId: "req-2",
      audioBase64: "ZmFrZQ==",
      contentType: "audio/mpeg",
    })

    await expect(firstPlayback).resolves.toEqual({ ok: false, reason: "interrupted" })
    expect(FakeAudio.instances[0]!.pause).toHaveBeenCalled()

    FakeAudio.instances[1]!.onended?.()
    await expect(secondPlayback).resolves.toEqual({ ok: true })
  })

  it("rejects and cleans up when the audio element fails", async () => {
    const { FakeAudio, revokeObjectURLMock } = installFakeAudio()
    const controller = new DOMAudioPlaybackController("playback failed")

    const playbackPromise = controller.play({
      requestId: "req-1",
      audioBase64: "ZmFrZQ==",
      contentType: "audio/mpeg",
    })

    FakeAudio.instances[0]!.onerror?.()

    await expect(playbackPromise).rejects.toThrow("playback failed")
    expect(FakeAudio.instances[0]!.pause).toHaveBeenCalled()
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:tts-test-1")
  })
})
