// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SettingsSearch } from "../settings-search"

const mockedRouter = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: {
    pathname: "/",
    search: "",
    key: "loc-1",
  },
}))

const mockedSectionScroll = vi.hoisted(() => ({
  buildSectionSearch: vi.fn<(sectionId: string) => string>((sectionId: string) => `?section=${sectionId}`),
  getSectionIdFromSearch: vi.fn<(search: string) => string | null>(() => null),
  scrollToSectionWhenReady: vi.fn<(sectionId: string) => Promise<boolean>>().mockResolvedValue(true),
}))

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router")
  return {
    ...actual,
    useNavigate: () => mockedRouter.navigate,
    useLocation: () => mockedRouter.location,
  }
})

vi.mock("../search-items", () => ({
  SEARCH_ITEMS: [
    {
      sectionId: "feature-providers",
      route: "/",
      titleKey: "feature-providers-title",
      pageKey: "general-page",
    },
    {
      sectionId: "translation-mode",
      route: "/translation",
      titleKey: "translation-mode-title",
      pageKey: "translation-page",
    },
  ],
}))

vi.mock("../section-scroll", () => ({
  buildSectionSearch: mockedSectionScroll.buildSectionSearch,
  getSectionIdFromSearch: mockedSectionScroll.getSectionIdFromSearch,
  scrollToSectionWhenReady: mockedSectionScroll.scrollToSectionWhenReady,
}))

vi.mock("@/components/ui/base-ui/command", () => ({
  CommandDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandInput: (props: React.ComponentProps<"input">) => <input {...props} />,
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandItem: ({ children, onSelect }: { children: React.ReactNode, onSelect?: () => void }) => (
    <button type="button" onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
}))

function renderSettingsSearch() {
  const store = createStore()
  return render(
    <Provider store={store}>
      <SettingsSearch />
    </Provider>,
  )
}

describe("settings search navigation", () => {
  beforeEach(() => {
    mockedRouter.navigate.mockReset()
    mockedRouter.location.pathname = "/"
    mockedRouter.location.search = ""
    mockedRouter.location.key = "loc-1"

    mockedSectionScroll.buildSectionSearch.mockClear()
    mockedSectionScroll.buildSectionSearch.mockImplementation((sectionId: string) => `?section=${sectionId}`)
    mockedSectionScroll.getSectionIdFromSearch.mockReset()
    mockedSectionScroll.getSectionIdFromSearch.mockReturnValue(null)
    mockedSectionScroll.scrollToSectionWhenReady.mockReset()
    mockedSectionScroll.scrollToSectionWhenReady.mockResolvedValue(true)
  })

  it("navigates with section query when target route differs", () => {
    renderSettingsSearch()

    fireEvent.click(screen.getByRole("button", { name: "translation-mode-title" }))

    expect(mockedSectionScroll.buildSectionSearch).toHaveBeenCalledWith("translation-mode")
    expect(mockedRouter.navigate).toHaveBeenCalledWith({
      pathname: "/translation",
      search: "?section=translation-mode",
    })
    expect(mockedSectionScroll.scrollToSectionWhenReady).not.toHaveBeenCalled()
  })

  it("scrolls directly when current location already matches route and section", () => {
    mockedRouter.location.pathname = "/translation"
    mockedRouter.location.search = "?section=translation-mode"

    renderSettingsSearch()

    fireEvent.click(screen.getByRole("button", { name: "translation-mode-title" }))

    expect(mockedRouter.navigate).not.toHaveBeenCalled()
    expect(mockedSectionScroll.scrollToSectionWhenReady).toHaveBeenCalledWith("translation-mode")
  })

  it("updates search params when route matches but section differs", () => {
    mockedRouter.location.pathname = "/translation"
    mockedRouter.location.search = "?section=feature-providers"

    renderSettingsSearch()

    fireEvent.click(screen.getByRole("button", { name: "translation-mode-title" }))

    expect(mockedRouter.navigate).toHaveBeenCalledWith({
      pathname: "/translation",
      search: "?section=translation-mode",
    })
  })

  it("scrolls from URL section param on location updates", async () => {
    mockedRouter.location.search = "?section=feature-providers"
    mockedSectionScroll.getSectionIdFromSearch.mockReturnValue("feature-providers")

    renderSettingsSearch()

    await waitFor(() => {
      expect(mockedSectionScroll.scrollToSectionWhenReady).toHaveBeenCalledWith("feature-providers")
    })
  })
})
