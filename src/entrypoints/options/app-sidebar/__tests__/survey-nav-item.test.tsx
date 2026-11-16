// @vitest-environment jsdom
import type { ReactElement, ReactNode } from "react"
import type { SurveyPrompt } from "@/utils/survey-prompt"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getSurveyPromptMock = vi.fn<(locale: string) => Promise<SurveyPrompt | null>>()
const getClickedKeysMock = vi.fn<() => Promise<string[]>>()
const markClickedMock = vi.fn<(key: string) => Promise<string[]>>()

vi.mock("jotai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jotai")>()),
  useAtomValue: () => "zh-CN",
}))

vi.mock("@/env", () => ({
  env: { WXT_WEBSITE_URL: "https://www.readfrog.app" },
}))

vi.mock("@/utils/blog", () => ({
  getBlogLocaleFromUILanguage: (uiLanguage: string) => (uiLanguage === "zh-CN" ? "zh" : "en"),
}))

vi.mock("@/utils/survey-prompt", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/survey-prompt")>()),
  getSurveyPrompt: (locale: string) => getSurveyPromptMock(locale),
  getClickedSurveyPromptKeys: () => getClickedKeysMock(),
  markSurveyPromptClicked: (key: string) => markClickedMock(key),
}))

vi.mock("@iconify/react", () => ({
  Icon: ({ icon }: { icon: string }) => <span aria-hidden="true" data-icon={icon} />,
}))

vi.mock("@/components/ui/base-ui/sidebar", () => ({
  SidebarMenuItem: ({ children }: { children: ReactNode }) => <li>{children}</li>,
  SidebarMenuButton: ({
    children,
    render: renderElement,
    tooltip,
  }: {
    children: ReactNode
    render: ReactElement<{ children?: ReactNode }>
    tooltip?: string
  }) => React.cloneElement(renderElement, { "data-tooltip": tooltip } as object, children),
}))

const { SurveyNavItem } = await import("../survey-nav-item")

const PROMPT: SurveyPrompt = {
  key: "2026-11",
  path: "/zh/survey/2026-11",
  label: "问卷",
  badge: "有奖",
  closesAtMs: null,
}

function renderItem() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <ul>
        <li>Help & Community</li>
        <SurveyNavItem />
      </ul>
    </QueryClientProvider>,
  )
  return { ...result, queryClient }
}

beforeEach(() => {
  getSurveyPromptMock.mockResolvedValue(PROMPT)
  getClickedKeysMock.mockResolvedValue([])
  markClickedMock.mockResolvedValue([PROMPT.key])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("SurveyNavItem", () => {
  it("links to the survey in the reader's language, marked as reached from the sidebar", async () => {
    renderItem()

    const link = await screen.findByRole("link", { name: /问卷/ })
    expect(getSurveyPromptMock).toHaveBeenCalledWith("zh")
    expect(link).toHaveAttribute(
      "href",
      "https://www.readfrog.app/zh/survey/2026-11?from=extension_sidebar",
    )
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("data-tooltip", "问卷")
    expect(await screen.findByText("有奖")).toBeInTheDocument()
    expect(screen.getByTestId("survey-nav-dot")).toBeInTheDocument()
  })

  it("shows nothing when there is no survey to show", async () => {
    getSurveyPromptMock.mockResolvedValue(null)
    const { container, queryClient } = renderItem()

    // While loading the item renders nothing either, so wait for the answer, and
    // for the render it causes: the query tells the component on a later tick.
    await waitFor(() =>
      expect(queryClient.getQueryState(["survey-prompt", "zh"])?.status).toBe("success"),
    )
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
    // A render error would take the whole list down, the row before it included.
    expect(container.querySelectorAll("li")).toHaveLength(1)
    expect(screen.getByText("Help & Community")).toBeInTheDocument()
  })

  it("shows no badge or dot for a survey without a badge", async () => {
    getSurveyPromptMock.mockResolvedValue({ ...PROMPT, badge: null })
    renderItem()

    await screen.findByRole("link", { name: "问卷" })
    expect(screen.queryByTestId("survey-nav-dot")).toBeNull()
  })

  it("shows no badge once this survey's entry has been clicked", async () => {
    getClickedKeysMock.mockResolvedValue(["2026-11"])
    renderItem()

    await screen.findByRole("link", { name: "问卷" })
    await waitFor(() => expect(getClickedKeysMock).toHaveBeenCalled())
    expect(screen.queryByText("有奖")).toBeNull()
  })

  it("still shows the badge for a new survey after an older one was clicked", async () => {
    getClickedKeysMock.mockResolvedValue(["2026-05"])
    renderItem()

    expect(await screen.findByText("有奖")).toBeInTheDocument()
  })

  it("drops the badge and remembers the survey when the entry is clicked", async () => {
    renderItem()
    const link = await screen.findByRole("link", { name: /问卷/ })
    await screen.findByText("有奖")

    fireEvent.click(link)

    expect(markClickedMock).toHaveBeenCalledWith("2026-11")
    await waitFor(() => expect(screen.queryByText("有奖")).toBeNull())
    expect(screen.queryByTestId("survey-nav-dot")).toBeNull()
  })

  it("counts a middle click, which opens the survey too", async () => {
    renderItem()
    const link = await screen.findByRole("link", { name: /问卷/ })

    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, button: 1 }))

    expect(markClickedMock).toHaveBeenCalledWith("2026-11")
  })
})
