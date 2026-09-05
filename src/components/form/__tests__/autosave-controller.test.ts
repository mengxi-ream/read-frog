import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createAutosaveController } from "../autosave-controller"

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function harness(initial = { name: "Original", description: "", model: { id: "a" } }) {
  let draft = structuredClone(initial)
  let validation: (() => Promise<void>) | undefined
  let valid = true
  const persist = vi.fn<
    (snapshot: typeof initial, changes: Partial<typeof initial>) => Promise<void>
  >(async () => {})
  const controller = createAutosaveController({
    initialValue: initial,
    getDraft: () => draft,
    setField: (key, value) => {
      draft = { ...draft, [key]: value }
    },
    reset: (value) => {
      draft = structuredClone(value)
    },
    submit: async (revision) => {
      await validation?.()
      if (valid) await controller.commit(draft, revision)
    },
    persist,
  })
  return {
    controller,
    persist,
    get draft() {
      return draft
    },
    update: (changes: Partial<typeof initial>) => {
      draft = { ...draft, ...changes }
    },
    edit: (changes: Partial<typeof initial>, immediate = false) =>
      controller.edit(
        () => {
          draft = { ...draft, ...changes }
        },
        { immediate },
      ),
    validateWith: (fn: () => Promise<void>) => {
      validation = fn
    },
    setValid: (value: boolean) => {
      valid = value
    },
  }
}

async function tick(ms = 500) {
  await vi.advanceTimersByTimeAsync(ms)
}

describe("autosave controller", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("updates synchronously and saves only after the final 500ms pause", async () => {
    const h = harness()
    h.edit({ name: "one" })
    expect(h.draft.name).toBe("one")
    await tick(400)
    h.edit({ name: "two" })
    await tick(499)
    expect(h.persist).not.toHaveBeenCalled()
    await tick(1)
    expect(h.persist).toHaveBeenCalledExactlyOnceWith(h.draft, { name: "two" })
    expect(h.controller.getSnapshot().dirty).toBe(false)
  })

  it("pauses the whole form during composition, including a pending blur flush", async () => {
    const h = harness()
    h.edit({ description: "changed" })
    h.controller.beginComposition("name")
    h.edit({ name: "nihao" })
    const flushed = h.controller.flush()
    await tick(2000)
    expect(h.persist).not.toHaveBeenCalled()
    h.controller.endComposition("name", () => h.update({ name: "你好" }))
    expect(await flushed).toBe("saved")
    expect(h.persist).toHaveBeenCalledExactlyOnceWith(h.draft, {
      name: "你好",
      description: "changed",
    })
    h.edit({ name: "你好" })
    await tick()
    expect(h.persist).toHaveBeenCalledTimes(1)
  })

  it("preserves a newer draft when an optimistic echo and delayed save complete", async () => {
    const h = harness()
    const storage = deferred()
    h.persist.mockImplementationOnce(async (snapshot) => {
      h.controller.reconcile(snapshot)
      await storage.promise
    })
    h.edit({ name: "first" })
    await tick()
    h.controller.beginComposition("name")
    h.edit({ name: "firstni" })
    storage.resolve()
    await tick(0)
    expect(h.draft.name).toBe("firstni")
    expect(h.controller.getSnapshot().dirty).toBe(true)
    h.controller.endComposition("name", () => h.update({ name: "first你" }))
    await tick()
    expect(h.persist).toHaveBeenCalledTimes(2)
    expect(h.persist.mock.lastCall?.[0].name).toBe("first你")
  })

  it("invalidates an attempt when composition starts during async validation", async () => {
    const h = harness()
    const validation = deferred()
    h.validateWith(() => validation.promise)
    h.edit({ name: "first" })
    await tick()
    h.controller.beginComposition("name")
    h.edit({ name: "ni" })
    validation.resolve()
    await tick(0)
    expect(h.persist).not.toHaveBeenCalled()
    h.controller.endComposition("name", () => h.update({ name: "你" }))
    await tick()
    expect(h.persist.mock.lastCall?.[0].name).toBe("你")
  })

  it("coalesces changes during saving and flush waits for the last one", async () => {
    const h = harness()
    const storage = deferred()
    h.persist.mockImplementationOnce(() => storage.promise)
    h.edit({ name: "first" }, true)
    await tick(0)
    h.edit({ name: "second" })
    h.edit({ name: "third" })
    const flush = h.controller.flush()
    expect(h.persist).toHaveBeenCalledTimes(1)
    storage.resolve()
    expect(await flush).toBe("saved")
    expect(h.persist).toHaveBeenCalledTimes(2)
    expect(h.persist.mock.lastCall?.[0].name).toBe("third")
  })

  it("does not mistake validation failure for success and retries after correction", async () => {
    const h = harness()
    h.setValid(false)
    h.edit({ name: "" })
    expect(await h.controller.flush()).toBe("invalid")
    expect(h.controller.getSnapshot()).toMatchObject({ dirty: true, error: "invalid" })
    expect(h.persist).not.toHaveBeenCalled()
    h.setValid(true)
    h.edit({ name: "valid" })
    expect(await h.controller.flush()).toBe("saved")
  })

  it("preserves failed drafts without an infinite retry loop", async () => {
    const h = harness()
    h.persist.mockRejectedValueOnce(new Error("offline"))
    h.edit({ name: "keep me" })
    expect(await h.controller.flush()).toBe("failed")
    await tick(10000)
    expect(h.persist).toHaveBeenCalledTimes(1)
    expect(h.draft.name).toBe("keep me")
    expect(await h.controller.flush()).toBe("saved")
  })

  it("merges pristine external fields and keeps local conflicts, including nested objects", async () => {
    const h = harness()
    h.edit({ name: "local" })
    h.controller.reconcile({ name: "remote", description: "new description", model: { id: "b" } })
    expect(h.draft).toEqual({ name: "local", description: "new description", model: { id: "b" } })
    await h.controller.flush()
    expect(h.persist.mock.lastCall?.[1]).toEqual({ name: "local" })
  })

  it("does not save a reverted draft or a discarded pending change", async () => {
    const h = harness()
    h.edit({ name: "other" })
    h.edit({ name: "Original" })
    expect(await h.controller.flush()).toBe("unchanged")
    h.edit({ name: "discard" })
    await h.controller.discard()
    await tick()
    expect(h.draft.name).toBe("Original")
    expect(h.persist).not.toHaveBeenCalled()
  })

  it("waits for an in-flight save before discarding newer edits", async () => {
    const h = harness()
    const storage = deferred()
    h.persist.mockImplementationOnce(() => storage.promise)
    h.edit({ name: "saved" }, true)
    await tick(0)
    h.edit({ name: "discard" })
    const discard = h.controller.discard()
    storage.resolve()
    await discard
    expect(h.draft.name).toBe("saved")
    expect(h.persist).toHaveBeenCalledTimes(1)
  })

  it("retains deleted-entity drafts and never recreates the entity", async () => {
    const h = harness()
    h.edit({ name: "keep me" })
    h.controller.reconcile(undefined)
    expect(await h.controller.flush()).toBe("failed")
    await tick()
    expect(h.draft.name).toBe("keep me")
    expect(h.persist).not.toHaveBeenCalled()
    expect(h.controller.getSnapshot().error).toBe("deleted")
  })

  it("prepares the latest raw editor text and acknowledges the saved raw snapshot", async () => {
    const h = harness()
    let raw = "Original"
    let saved = raw
    h.controller.registerSource("name", {
      isDirty: () => raw !== saved,
      snapshot: () => raw,
      prepare: () => {
        if (raw === "invalid") return false
        h.update({ name: raw })
        return true
      },
      acknowledge: (value) => {
        saved = value
      },
      reset: (value) => {
        raw = saved = String(value)
      },
    })
    h.controller.edit(() => {
      raw = "invalid"
    })
    expect(await h.controller.flush()).toBe("invalid")
    expect(h.persist).not.toHaveBeenCalled()
    h.controller.edit(() => {
      raw = "latest"
    })
    expect(await h.controller.flush()).toBe("saved")
    expect(saved).toBe("latest")
  })

  it("lets an explicit form command replace an incomplete raw draft", async () => {
    const h = harness()
    let raw = "Original"
    let saved = raw
    h.controller.registerSource("name", {
      isDirty: () => raw !== saved,
      snapshot: () => raw,
      prepare: () => raw !== "invalid",
      acknowledge: (value) => {
        saved = value
      },
      reset: (value) => {
        raw = saved = String(value)
      },
    })
    h.controller.edit(() => {
      raw = "invalid"
    })
    h.edit({ name: "recommended" })
    expect(raw).toBe("recommended")
    expect(await h.controller.flush()).toBe("saved")
    expect(h.persist.mock.lastCall?.[0].name).toBe("recommended")
  })

  it("cancels scheduled writes on teardown and can reactivate for Strict Mode", async () => {
    const h = harness()
    h.edit({ name: "pending" })
    h.controller.deactivate()
    await tick()
    expect(h.persist).not.toHaveBeenCalled()
    h.controller.activate()
    h.edit({ name: "next" })
    await tick()
    expect(h.persist).toHaveBeenCalledTimes(1)
  })
})
