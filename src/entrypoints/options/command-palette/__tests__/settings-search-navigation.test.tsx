// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SettingsSearch } from "../settings-search"

const mockedRouter = vi.hoisted(() => ({
  navigate: vi.fn<(...args: any[]) => any>(),
  location: {
    pathname: "/",
    search: "",
    key: "loc-1",
  },
}))

const mockedSectionScroll = vi.hoisted(() => ({
  buildSectionSearch: vi.fn<(sectionId: string) => string>(
    (sectionId: string) => `?section=${sectionId}`,
  ),
  getSectionIdFromSearch: vi.fn<(search: string) => string | null>(() => null),
  scrollToSectionWhenReady: vi
    .fn<(sectionId: string) => Promise<boolean>>()
    .mockResolvedValue(true),
}))

const mockedSimpleMode = vi.hoisted(() => ({ subtitlesOff: false }))

vi.mock("../../pages/advanced/simple-mode/links", () => ({
  buildTurnOnLink: (_config: unknown, tag: unknown) =>
    tag === "videoSubtitles" && mockedSimpleMode.subtitlesOff
      ? "/advanced/simple-mode?section=simple-mode-videoSubtitles"
      : undefined,
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
      route: "/page-translation",
      titleKey: "translation-mode-title",
      pageKey: "translation-page",
    },
    {
      sectionId: "subtitles-ai-quota",
      route: "/usage",
      titleKey: "subtitles-quota-title",
      pageKey: "usage-page",
      feature: "videoSubtitles",
    },
    {
      sectionId: "floating-button-click-action",
      route: "/floating-button",
      gate: "sidePanel",
      titleKey: "click-action-title",
      pageKey: "floating-button-page",
    },
  ],
}))

vi.mock("../../pages/difficult-words/access", () => ({
  useIsDifficultWordsOpen: () => false,
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
  CommandItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
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
    mockedSimpleMode.subtitlesOff = false

    mockedSectionScroll.buildSectionSearch.mockClear()
    mockedSectionScroll.buildSectionSearch.mockImplementation(
      (sectionId: string) => `?section=${sectionId}`,
    )
    mockedSectionScroll.getSectionIdFromSearch.mockReset()
    mockedSectionScroll.getSectionIdFromSearch.mockReturnValue(null)
    mockedSectionScroll.scrollToSectionWhenReady.mockReset()
    mockedSectionScroll.scrollToSectionWhenReady.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each(["chrome", "edge", "firefox"])(
    "finds the floating button's click action in %s",
    (target) => {
      vi.stubEnv("BROWSER", target)
      renderSettingsSearch()

      expect(screen.getByRole("button", { name: "click-action-title" })).toBeInTheDocument()
    },
  )

  it("leaves the floating button's click action out in Safari, which has no side panel to open", () => {
    vi.stubEnv("BROWSER", "safari")
    renderSettingsSearch()

    expect(screen.queryByRole("button", { name: "click-action-title" })).toBeNull()
    expect(screen.getByRole("button", { name: "translation-mode-title" })).toBeInTheDocument()
  })

  it("navigates with section query when target route differs", () => {
    renderSettingsSearch()

    fireEvent.click(screen.getByRole("button", { name: "translation-mode-title" }))

    expect(mockedSectionScroll.buildSectionSearch).toHaveBeenCalledWith("translation-mode")
    expect(mockedRouter.navigate).toHaveBeenCalledWith({
      pathname: "/page-translation",
      search: "?section=translation-mode",
    })
    expect(mockedSectionScroll.scrollToSectionWhenReady).not.toHaveBeenCalled()
  })

  it("opens a feature's section like any other while the feature is on", () => {
    renderSettingsSearch()

    fireEvent.click(screen.getByRole("button", { name: "subtitles-quota-title" }))

    expect(mockedRouter.navigate).toHaveBeenCalledWith({
      pathname: "/usage",
      search: "?section=subtitles-ai-quota",
    })
  })

  it("lands on the feature's switch when simple mode turned it off", () => {
    mockedSimpleMode.subtitlesOff = true

    renderSettingsSearch()

    fireEvent.click(screen.getByRole("button", { name: "subtitles-quota-title" }))

    expect(mockedRouter.navigate).toHaveBeenCalledTimes(1)
    expect(mockedRouter.navigate).toHaveBeenCalledWith(
      "/advanced/simple-mode?section=simple-mode-videoSubtitles",
    )
  })

  it("scrolls directly when current location already matches route and section", () => {
    mockedRouter.location.pathname = "/page-translation"
    mockedRouter.location.search = "?section=translation-mode"

    renderSettingsSearch()

    fireEvent.click(screen.getByRole("button", { name: "translation-mode-title" }))

    expect(mockedRouter.navigate).not.toHaveBeenCalled()
    expect(mockedSectionScroll.scrollToSectionWhenReady).toHaveBeenCalledWith("translation-mode")
  })

  it("updates search params when route matches but section differs", () => {
    mockedRouter.location.pathname = "/page-translation"
    mockedRouter.location.search = "?section=feature-providers"

    renderSettingsSearch()

    fireEvent.click(screen.getByRole("button", { name: "translation-mode-title" }))

    expect(mockedRouter.navigate).toHaveBeenCalledWith({
      pathname: "/page-translation",
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
