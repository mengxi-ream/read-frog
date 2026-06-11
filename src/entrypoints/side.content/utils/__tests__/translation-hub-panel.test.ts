import { describe, expect, it, vi } from "vitest"
import { MIN_SIDE_CONTENT_WIDTH } from "@/utils/constants/side"
import { getTranslationHubSidePanelWidth, MIN_MAIN_CONTENT_WIDTH_WITH_SIDE_PANEL } from "../translation-hub-panel"

vi.mock("#imports", () => ({
  browser: {
    runtime: {
      getURL: (path = "") => `chrome-extension://test-extension${path}`,
    },
  },
}))

vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn(),
}))

describe("translation hub side panel width", () => {
  it("allows the configured minimum side content width", () => {
    expect(getTranslationHubSidePanelWidth(360, 1200)).toBe(MIN_SIDE_CONTENT_WIDTH)
  })

  it("leaves enough room for the page content", () => {
    expect(getTranslationHubSidePanelWidth(900, 1200)).toBe(1200 - MIN_MAIN_CONTENT_WIDTH_WITH_SIDE_PANEL)
  })
})
