// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { atom, createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { DifficultWordsButton } from "../difficult-words-button"

const mocks = vi.hoisted(() => ({
  sendMessage: vi.fn<(...args: any[]) => Promise<unknown>>(),
  toastAdd: vi.fn<(toast: unknown) => string>(() => "toast"),
}))

vi.mock("@/utils/message", () => ({ sendMessage: mocks.sendMessage }))
vi.mock("@/components/ui/base-ui/toast", () => ({ toastManager: { add: mocks.toastAdd } }))
vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))
vi.mock("@/utils/difficult-words/tab-state", () => ({
  useDifficultWordsAccess: () => ({ data: "allowed" }),
}))
vi.mock("@/utils/atoms/config", async () => {
  const jotai = await import("jotai")
  return {
    configFieldsAtomMap: {
      difficultWords: jotai.atom({ enabled: true }),
      pageTranslation: jotai.atom({ mode: "bilingual" }),
      siteControl: jotai.atom({ mode: "blacklist" }),
    },
  }
})
vi.mock("../../atoms/auto-translate", () => ({ isPageTranslatedAtom: atom(false) }))
vi.mock("../../atoms/ignore", () => ({ isIgnoreTabAtom: atom(false) }))
vi.mock("../../atoms/site-control", () => ({
  isCurrentSiteInWhitelistAtom: atom(false),
  isCurrentSiteInBlacklistAtom: atom(false),
}))

function renderButton() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={createStore()}>
        <TooltipProvider>
          <DifficultWordsButton />
        </TooltipProvider>
      </Provider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe("DifficultWordsButton", () => {
  it("says so when the page does not answer, as one open from before Read Frog was", async () => {
    vi.spyOn(browser.tabs, "query").mockResolvedValue([{ id: 7 }] as any)
    mocks.sendMessage.mockRejectedValue(
      new Error("Could not establish connection. Receiving end does not exist."),
    )
    renderButton()

    const button = screen.getByRole("button", { name: "difficultWords.scan" })
    await waitFor(() => {
      expect(mocks.sendMessage).toHaveBeenCalledWith("getDifficultWordsState", undefined, {
        tabId: 7,
        frameId: 0,
      })
    })
    // The state read failing alone shows nothing: the page may still be loading.
    expect(mocks.toastAdd).not.toHaveBeenCalled()

    fireEvent.click(button)

    await waitFor(() => {
      expect(mocks.toastAdd).toHaveBeenCalledWith({
        type: "error",
        title: "difficultWords.unavailableHere",
        description: "difficultWords.unavailableHereHint",
      })
    })
    expect(mocks.sendMessage).toHaveBeenCalledWith(
      "setDifficultWordsEnabled",
      { enabled: true },
      { tabId: 7, frameId: 0 },
    )
  })
})
