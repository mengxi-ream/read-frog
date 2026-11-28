// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { isStoreReviewPromptDismissed } from "@/utils/store-review"
import { StoreReviewPrompt } from "../store-review-prompt"

const REVIEW_URL = "https://chromewebstore.google.com/detail/read-frog/id/reviews"

const mocks = vi.hoisted(() => ({
  openInNewTab: vi.fn<(url: string) => Promise<void>>(),
}))

vi.mock("@/utils/navigation", () => ({ openInNewTab: mocks.openInNewTab }))
vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))
vi.mock("@/utils/feature-active-days", () => ({
  getFeatureActiveDays: async () => ({ lastDay: "2026-11-27", count: 3 }),
}))
vi.mock("@/utils/utils", () => ({ getReviewUrl: () => REVIEW_URL }))

function renderPrompt() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <StoreReviewPrompt />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  fakeBrowser.reset()
  vi.clearAllMocks()
})

describe("StoreReviewPrompt", () => {
  it("saves the dismissal before it opens the store, as opening the tab closes the popup", async () => {
    // What the popup has saved by the time the store's tab opens: nothing it
    // does after that is sure to run.
    let dismissedWhenOpened: boolean | undefined
    mocks.openInNewTab.mockImplementation(async () => {
      dismissedWhenOpened = await isStoreReviewPromptDismissed()
    })

    renderPrompt()
    fireEvent.click(await screen.findByText("popup.storeReview.action"))

    await waitFor(() => expect(mocks.openInNewTab).toHaveBeenCalledExactlyOnceWith(REVIEW_URL))
    expect(dismissedWhenOpened).toBe(true)
  })
})
