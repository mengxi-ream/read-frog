// @vitest-environment jsdom
import { act, render, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { difficultWordsTab } from "@/utils/difficult-words/tab-state"
import { DifficultWords } from "../index"

const mocks = vi.hoisted(() => ({
  access: "allowed" as string,
  /** The keys registered and not unregistered since. */
  keys: new Set<string>(),
  view: { card: null, check: null, levelLang: null },
}))

vi.mock("@tanstack/hotkeys", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/hotkeys")>()),
  HotkeyManager: {
    getInstance: () => ({
      register: (chord: string) => {
        mocks.keys.add(chord)
        return { unregister: () => mocks.keys.delete(chord) }
      },
    }),
  },
}))
vi.mock("@/utils/atoms/config", async () => {
  const jotai = await import("jotai")
  const configAtom = jotai.atom({
    difficultWords: { enabled: true },
    pageTranslation: { mode: "bilingual" },
    language: { targetCode: "zh-Hans" },
  })
  return {
    configAtom,
    configFieldsAtomMap: { difficultWords: jotai.atom((get) => get(configAtom).difficultWords) },
  }
})
vi.mock("@/utils/difficult-words/tab-state", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/difficult-words/tab-state")>()),
  useDifficultWordsAccess: () => ({ data: mocks.access }),
}))
vi.mock("@/utils/message", () => ({
  onMessage: () => () => {},
  sendMessage: (type: string) =>
    Promise.resolve(type === "getDifficultWordsAccess" ? "allowed" : false),
}))
vi.mock("@/utils/annotate/marks", () => ({ supportsHighlightApi: () => true }))
vi.mock("@/utils/analytics", () => ({
  createFeatureUsageContext: () => ({}),
  trackFeatureUsed: () => Promise.resolve(),
}))
vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: vi.fn<(toast: unknown) => string>() },
}))
vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))
vi.mock("../../annotation/provider", () => ({
  useAnnotation: () => ({ mode: false, annotate: () => false }),
}))
vi.mock("../card", () => ({ DifficultWordCard: () => null }))
vi.mock("../known-check", () => ({ KnownCheck: () => null }))
vi.mock("../level-picker", () => ({ LevelPicker: () => null }))
vi.mock("../session", () => ({
  DifficultWordsSession: class {
    start = vi.fn<() => void>()
    dispose = vi.fn<() => void>()
    subscribe = () => () => {}
    getView = () => mocks.view
  },
  showRestrictedNotice: vi.fn<() => void>(),
  showSignInRequiredNotice: vi.fn<() => void>(),
}))

function marking(store: ReturnType<typeof createStore>) {
  return (
    <Provider store={store}>
      <DifficultWords />
    </Provider>
  )
}

afterEach(() => {
  mocks.access = "allowed"
  mocks.keys.clear()
})

describe("DifficultWords", () => {
  it("keeps its key while marking is on, after the account lost the feature", async () => {
    const store = createStore()
    const { rerender, unmount } = render(marking(store))
    expect(mocks.keys).toEqual(new Set(["Alt+Shift+V"]))

    await act(async () => {
      difficultWordsTab.setEnabled(true, null)
    })
    await waitFor(() => {
      expect(difficultWordsTab.getState().enabled).toBe(true)
    })

    mocks.access = "signedOut"
    rerender(marking(store))
    // On, it can always be switched off.
    expect(mocks.keys).toEqual(new Set(["Alt+Shift+V"]))

    await act(async () => {
      difficultWordsTab.setEnabled(false, null)
    })
    expect(difficultWordsTab.getState().enabled).toBe(false)
    expect(mocks.keys).toEqual(new Set())
    unmount()
  })
})
