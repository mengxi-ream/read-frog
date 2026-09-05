// @vitest-environment jsdom
// oxlint-disable typescript/unbound-method -- The storage methods are vi.fn mocks and have no receiver.
import type { Config } from "@/types/config/config"
import { createStore } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { configAtom, writeConfigAtom } from "../config"
import { patchActionConfigAtom, patchProviderConfigAtom } from "../entity-config"
import { storageAdapter } from "../storage-adapter"

const storage = vi.hoisted(() => ({ value: {} as Config, watchers: new Set<() => void>() }))
vi.mock("../storage-adapter", () => ({
  storageAdapter: {
    get: vi.fn<() => Promise<Config>>(async () => structuredClone(storage.value)),
    set: vi.fn<(key: string, value: Config) => Promise<void>>(async (_key, value) => {
      storage.value = structuredClone(value)
      storage.watchers.forEach((notify) => notify())
    }),
    setMeta: vi.fn<() => Promise<void>>(async () => {}),
    watch: (_key: string, notify: () => void) => {
      storage.watchers.add(notify)
      return () => storage.watchers.delete(notify)
    },
  },
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
const unsubs: (() => void)[] = []
function mountStore() {
  const store = createStore()
  store.set(configAtom, structuredClone(storage.value))
  unsubs.push(store.sub(configAtom, () => {}))
  return store
}

describe("config persistence and invalidation", () => {
  beforeEach(() => {
    storage.value = structuredClone(DEFAULT_CONFIG)
    vi.mocked(storageAdapter.get).mockClear()
    vi.mocked(storageAdapter.set).mockClear()
    vi.mocked(storageAdapter.setMeta).mockClear()
  })
  afterEach(() => {
    unsubs.splice(0).forEach((unsubscribe) => unsubscribe())
  })

  it("re-evaluates a pure updater against fresh storage and preserves unrelated changes", async () => {
    const store = mountStore()
    await tick()
    const source = storage.value.providersConfig.find((provider) => provider.provider === "openai")!
    storage.value.providersConfig = storage.value.providersConfig.map((provider) =>
      provider.id === source.id
        ? { ...provider, description: "external", headers: { old: "value" } }
        : provider,
    )
    await store.set(patchProviderConfigAtom, {
      id: source.id,
      changes: { name: "local", headers: undefined },
    })
    const result = storage.value.providersConfig.find((provider) => provider.id === source.id)
    expect(result).toMatchObject({ name: "local", description: "external" })
    expect(result).toHaveProperty("headers", undefined)
    expect(store.get(configAtom)).toEqual(storage.value)
  })

  it("preserves concurrent sibling changes and continues after a failed write", async () => {
    const store = mountStore()
    await tick()
    vi.mocked(storageAdapter.set).mockRejectedValueOnce(new Error("failed write"))
    const first = store.set(writeConfigAtom, { betaExperience: { enabled: true } })
    const failure = first.catch((error: unknown) => error)
    const second = store.set(writeConfigAtom, { uiLanguage: "zh-CN" })
    expect(await failure).toEqual(new Error("failed write"))
    await second
    await tick()
    expect(storage.value.uiLanguage).toBe("zh-CN")
    expect(store.get(configAtom)).toEqual(storage.value)
  })

  it("does not let an initial read overwrite a newer local write", async () => {
    const staleRead = deferred<Config>()
    const stale = structuredClone(storage.value)
    vi.mocked(storageAdapter.get).mockImplementationOnce(() => staleRead.promise)
    const store = mountStore()
    await tick()
    await store.set(writeConfigAtom, { uiLanguage: "zh-CN" })
    staleRead.resolve(stale)
    await tick()
    expect(store.get(configAtom).uiLanguage).toBe("zh-CN")
  })

  it("treats delayed notifications as invalidation and rereads the latest value", async () => {
    const store = mountStore()
    await tick()
    await store.set(writeConfigAtom, { uiLanguage: "zh-CN" })
    await store.set(writeConfigAtom, { uiLanguage: "ja" })
    storage.watchers.forEach((notify) => notify())
    await tick()
    expect(store.get(configAtom).uiLanguage).toBe("ja")
    storage.value = { ...storage.value, uiLanguage: "ko" }
    storage.watchers.forEach((notify) => notify())
    await tick()
    expect(store.get(configAtom).uiLanguage).toBe("ko")
  })

  it("does not replace optimistic state while a storage write is pending", async () => {
    const store = mountStore()
    await tick()
    const pending = deferred<void>()
    vi.mocked(storageAdapter.set).mockImplementationOnce(async (_key, value) => {
      await pending.promise
      storage.value = value as Config
    })
    const write = store.set(writeConfigAtom, { uiLanguage: "zh-CN" })
    storage.watchers.forEach((notify) => notify())
    await tick()
    expect(store.get(configAtom).uiLanguage).toBe("zh-CN")
    pending.resolve()
    await write
    await tick()
    expect(store.get(configAtom).uiLanguage).toBe("zh-CN")
  })

  it("patches only the edited action fields without replacing siblings or order", async () => {
    const action = {
      id: "a",
      name: "A",
      icon: "tabler:sparkles",
      providerId: "read-frog-free-ai",
      systemPrompt: "",
      prompt: "x",
      outputSchema: [
        {
          id: "result",
          name: "result",
          type: "string" as const,
          description: "Result",
          speaking: false,
        },
      ],
    }
    storage.value.selectionToolbar.customActions = [action, { ...action, id: "b", name: "B" }]
    const store = mountStore()
    await tick()
    storage.value.selectionToolbar.customActions = [
      { ...action, id: "b", name: "external B" },
      { ...action, prompt: "external prompt" },
    ]
    await store.set(patchActionConfigAtom, { id: "a", changes: { name: "local A" } })
    expect(storage.value.selectionToolbar.customActions.map(({ id }) => id)).toEqual(["b", "a"])
    expect(storage.value.selectionToolbar.customActions[0]?.name).toBe("external B")
    expect(storage.value.selectionToolbar.customActions[1]).toMatchObject({
      name: "local A",
      prompt: "external prompt",
    })
  })

  it("removes a built-in action connection rather than deep-merging the old value back", async () => {
    storage.value.selectionToolbar.builtInActions.dictionary.notebaseConnection = {
      notebaseId: "table",
      notebaseNameSnapshot: "Words",
      connectedAccount: { id: "user", name: "Reader", email: "reader@example.com" },
      mappings: [],
    }
    const store = mountStore()
    await tick()
    await store.set(patchActionConfigAtom, {
      id: "default-dictionary",
      changes: { notebaseConnection: undefined },
    })
    expect(
      storage.value.selectionToolbar.builtInActions.dictionary.notebaseConnection,
    ).toBeUndefined()
  })

  it("rejects an entity deleted before the queued update instead of recreating it", async () => {
    const store = mountStore()
    await tick()
    const source = storage.value.providersConfig.find((provider) => provider.provider === "openai")!
    storage.value.providersConfig = storage.value.providersConfig.filter(
      (provider) => provider.id !== source.id,
    )
    await expect(
      store.set(patchProviderConfigAtom, { id: source.id, changes: { name: "local" } }),
    ).rejects.toThrow("no longer exists")
    expect(storage.value.providersConfig.some((provider) => provider.id === source.id)).toBe(false)
  })
})
