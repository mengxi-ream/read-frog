import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PLAYBACK_BLOCKED_MESSAGE, WebAudioPlaybackController } from "../web-audio-controller"

class FakeSource {
  buffer: unknown = null
  onended: (() => void) | null = null
  connect = vi.fn<(destination: unknown) => void>()
  disconnect = vi.fn<() => void>()
  start = vi.fn<() => void>()
  stop = vi.fn<() => void>()
}

interface PendingDecode {
  // The audio's bytes, read as text.
  text: string
  resolve: (buffer: unknown) => void
  reject: (error: unknown) => void
}

/**
 * Like Safari's: suspended until the resume() a click started is granted, and
 * after that it resumes without a click. It runs suspend() and resume() one
 * after another, in the order they were called. Tests decide when decoding
 * finishes and when the click's resume() is granted.
 */
class FakeAudioContext {
  static instances: FakeAudioContext[] = []

  state: AudioContextState = "suspended"
  destination = { kind: "destination" }
  sources: FakeSource[] = []
  decodes: PendingDecode[] = []
  private started = false
  private waitingToStart: (() => void)[] = []
  private operations = Promise.resolve()

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  resume = vi.fn<() => Promise<void>>(() =>
    this.queue(async () => {
      if (!this.started) {
        await new Promise<void>((resolve) => this.waitingToStart.push(resolve))
      }
      this.state = "running"
    }),
  )

  suspend = vi.fn<() => Promise<void>>(() =>
    this.queue(async () => {
      this.state = "suspended"
    }),
  )

  decodeAudioData = vi.fn<(data: ArrayBuffer) => Promise<unknown>>(
    (data) =>
      new Promise((resolve, reject) => {
        this.decodes.push({ text: new TextDecoder().decode(data), resolve, reject })
      }),
  )

  createBufferSource = vi.fn<() => FakeSource>(() => {
    const source = new FakeSource()
    this.sources.push(source)
    return source
  })

  grant() {
    this.started = true
    for (const resolve of this.waitingToStart.splice(0)) resolve()
  }

  private queue(operation: () => Promise<void>) {
    const done = this.operations.then(operation)
    this.operations = done
    return done
  }
}

const userActivation = { isActive: false }

function request(requestId: string) {
  return { requestId, audioBase64: btoa(requestId), contentType: "audio/mpeg" }
}

// Lets the controller's awaits run.
function settle() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}

function onlyContext() {
  expect(FakeAudioContext.instances).toHaveLength(1)
  return FakeAudioContext.instances[0]!
}

/** A controller a click has started, now waiting with its context suspended. */
async function startedController() {
  userActivation.isActive = true
  const controller = new WebAudioPlaybackController()
  controller.prepare()
  const context = onlyContext()
  context.grant()
  await settle()
  userActivation.isActive = false
  expect(context.state).toBe("suspended")
  return { controller, context }
}

describe("web audio playback controller", () => {
  beforeEach(() => {
    FakeAudioContext.instances = []
    userActivation.isActive = false
    vi.stubGlobal("AudioContext", FakeAudioContext)
    vi.stubGlobal("navigator", { userActivation })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("starts its audio only while the user's click counts", async () => {
    const controller = new WebAudioPlaybackController()

    controller.prepare()
    const context = onlyContext()
    expect(context.resume).not.toHaveBeenCalled()

    userActivation.isActive = true
    controller.prepare()
    expect(context.resume).toHaveBeenCalledOnce()

    context.grant()
    await settle()
    controller.prepare()
    expect(context.resume).toHaveBeenCalledOnce()
  })

  // A running context keeps the Mac awake, even when it is silent.
  it("suspends the audio a click started when there is nothing to play", async () => {
    const { context } = await startedController()

    expect(context.resume).toHaveBeenCalledOnce()
    expect(context.suspend).toHaveBeenCalledOnce()
  })

  it("plays a chunk to its end, then suspends its audio", async () => {
    userActivation.isActive = true
    const controller = new WebAudioPlaybackController()

    const playback = controller.play(request("a"))
    const context = onlyContext()
    context.grant()
    expect(context.decodes[0]!.text).toBe("a")
    context.decodes[0]!.resolve("buffer-a")
    await settle()

    const source = context.sources[0]!
    expect(source.buffer).toBe("buffer-a")
    expect(source.connect).toHaveBeenCalledWith(context.destination)
    expect(source.start).toHaveBeenCalledOnce()
    expect(context.state).toBe("running")

    source.onended?.()
    await expect(playback).resolves.toEqual({ ok: true })
    expect(source.disconnect).toHaveBeenCalledOnce()
    await settle()
    expect(context.state).toBe("suspended")
  })

  it("waits for the resume the click started before it starts the audio", async () => {
    userActivation.isActive = true
    const controller = new WebAudioPlaybackController()

    void controller.play(request("a"))
    const context = onlyContext()
    context.decodes[0]!.resolve("buffer-a")
    await settle()
    expect(context.createBufferSource).not.toHaveBeenCalled()

    context.grant()
    await settle()
    expect(context.sources[0]!.start).toHaveBeenCalledOnce()
    expect(context.state).toBe("running")
  })

  // The later chunks of a long text, and a quiet autoplay after an earlier
  // click on the same page.
  it("resumes its audio without a click once a click has started it", async () => {
    const { controller, context } = await startedController()

    const playback = controller.play(request("b"))
    context.decodes[0]!.resolve("buffer-b")
    await settle()

    expect(context.resume).toHaveBeenCalledTimes(2)
    expect(context.sources[0]!.start).toHaveBeenCalledOnce()
    expect(context.state).toBe("running")
    context.sources[0]!.onended?.()
    await expect(playback).resolves.toEqual({ ok: true })
    await settle()
    expect(context.state).toBe("suspended")
  })

  it("fails at once, rather than waiting, when there was no click to start it", async () => {
    const controller = new WebAudioPlaybackController()

    const playback = controller.play(request("a"))
    const context = onlyContext()
    context.decodes[0]!.resolve("buffer-a")

    await expect(playback).rejects.toThrow(PLAYBACK_BLOCKED_MESSAGE)
    expect(context.resume).not.toHaveBeenCalled()
    expect(context.createBufferSource).not.toHaveBeenCalled()
  })

  it("stops the chunk playing and suspends its audio", async () => {
    userActivation.isActive = true
    const controller = new WebAudioPlaybackController()
    const playback = controller.play(request("a"))
    const context = onlyContext()
    context.grant()
    context.decodes[0]!.resolve("buffer-a")
    await settle()
    const source = context.sources[0]!

    controller.stop({ requestId: "other" })
    expect(source.stop).not.toHaveBeenCalled()

    controller.stop({ requestId: "a" })
    expect(source.stop).toHaveBeenCalledOnce()
    expect(source.disconnect).toHaveBeenCalledOnce()
    expect(source.onended).toBeNull()
    await expect(playback).resolves.toEqual({ ok: false, reason: "stopped" })
    await settle()
    expect(context.state).toBe("suspended")
  })

  it("never starts a chunk stopped while it decoded", async () => {
    userActivation.isActive = true
    const controller = new WebAudioPlaybackController()
    const playback = controller.play(request("a"))
    const context = onlyContext()
    context.grant()

    controller.stop()
    await expect(playback).resolves.toEqual({ ok: false, reason: "stopped" })

    context.decodes[0]!.resolve("buffer-a")
    await settle()
    expect(context.createBufferSource).not.toHaveBeenCalled()
    expect(context.state).toBe("suspended")
  })

  it("never resumes for a chunk stopped while the click's resume was pending", async () => {
    userActivation.isActive = true
    const controller = new WebAudioPlaybackController()
    const playback = controller.play(request("a"))
    const context = onlyContext()
    context.decodes[0]!.resolve("buffer-a")
    await settle()

    controller.stop()
    await expect(playback).resolves.toEqual({ ok: false, reason: "stopped" })
    context.grant()
    await settle()

    expect(context.resume).toHaveBeenCalledOnce()
    expect(context.createBufferSource).not.toHaveBeenCalled()
    expect(context.state).toBe("suspended")
  })

  it("leaves its audio suspended when stopped while it resumes", async () => {
    const { controller, context } = await startedController()
    const resume = context.resume.getMockImplementation()!
    context.resume.mockImplementationOnce(() => {
      const resumed = resume()
      controller.stop()
      return resumed
    })

    const playback = controller.play(request("b"))
    context.decodes[0]!.resolve("buffer-b")
    await expect(playback).resolves.toEqual({ ok: false, reason: "stopped" })
    await settle()

    expect(context.resume).toHaveBeenCalledTimes(2)
    expect(context.createBufferSource).not.toHaveBeenCalled()
    expect(context.state).toBe("suspended")
  })

  it("interrupts the chunk playing for a new one, through one audio context", async () => {
    userActivation.isActive = true
    const controller = new WebAudioPlaybackController()
    const first = controller.play(request("a"))
    const context = onlyContext()
    context.grant()
    context.decodes[0]!.resolve("buffer-a")
    await settle()

    const second = controller.play(request("b"))
    await expect(first).resolves.toEqual({ ok: false, reason: "interrupted" })
    expect(context.sources[0]!.stop).toHaveBeenCalledOnce()

    context.decodes[1]!.resolve("buffer-b")
    await settle()
    expect(context.sources[1]!.buffer).toBe("buffer-b")
    expect(context.state).toBe("running")
    context.sources[1]!.onended?.()
    await expect(second).resolves.toEqual({ ok: true })
    expect(FakeAudioContext.instances).toHaveLength(1)
    await settle()
    expect(context.state).toBe("suspended")
  })

  it("plays only the newer chunk when the older one finishes decoding after it", async () => {
    userActivation.isActive = true
    const controller = new WebAudioPlaybackController()
    const first = controller.play(request("a"))
    const context = onlyContext()
    context.grant()
    void controller.play(request("b"))
    await expect(first).resolves.toEqual({ ok: false, reason: "interrupted" })

    context.decodes[1]!.resolve("buffer-b")
    context.decodes[0]!.resolve("buffer-a")
    await settle()

    expect(context.sources.map((source) => source.buffer)).toEqual(["buffer-b"])
  })

  it("fails a chunk its audio cannot be decoded from", async () => {
    userActivation.isActive = true
    const controller = new WebAudioPlaybackController()
    const playback = controller.play(request("a"))
    const context = onlyContext()
    context.grant()

    const error = new Error("EncodingError")
    context.decodes[0]!.reject(error)

    await expect(playback).rejects.toBe(error)
    expect(context.createBufferSource).not.toHaveBeenCalled()
    await settle()
    expect(context.state).toBe("suspended")
  })
})
