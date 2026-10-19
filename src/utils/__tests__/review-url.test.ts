import { afterEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { getReviewUrl } from "../utils"

const CHROME_LISTING = "https://chromewebstore.google.com/detail/read-frog-translate-learn/"
const EDGE_LISTING = "https://microsoftedge.microsoft.com/addons/detail/read-frog-translate-l/"
const AMO_LISTING = "https://addons.mozilla.org/firefox/addon/read-frog-open-ai-translator/"

const testRuntimeId = browser.runtime.id

function installedWithId(id: string) {
  Object.defineProperty(browser.runtime, "id", { configurable: true, value: id })
}

afterEach(() => {
  Object.defineProperty(browser.runtime, "id", { configurable: true, value: testRuntimeId })
  vi.unstubAllEnvs()
})

describe("getReviewUrl", () => {
  it("sends an Edge Add-ons install to Edge even when it runs the Chrome build", () => {
    vi.stubEnv("BROWSER", "chrome")
    installedWithId("cbcbomlgikfbdnoaohcjfledcoklcjbo")
    expect(getReviewUrl("popup")).toBe(
      `${EDGE_LISTING}cbcbomlgikfbdnoaohcjfledcoklcjbo?form=MA13IW&utm_source=popup`,
    )
  })

  it("sends a Chrome Web Store install to Chrome even when it runs the Edge build", () => {
    vi.stubEnv("BROWSER", "edge")
    installedWithId("modkelfkcfjpgbfmnbnllalkiogfofhb")
    expect(getReviewUrl("popup")).toBe(
      `${CHROME_LISTING}modkelfkcfjpgbfmnbnllalkiogfofhb/reviews?utm_source=popup`,
    )
  })

  it.each([
    ["chrome", `${CHROME_LISTING}modkelfkcfjpgbfmnbnllalkiogfofhb/reviews?utm_source=extension`],
    ["edge", `${EDGE_LISTING}cbcbomlgikfbdnoaohcjfledcoklcjbo?form=MA13IW&utm_source=extension`],
    ["firefox", `${AMO_LISTING}reviews/?utm_source=extension`],
  ])("falls back to the %s build target for any other id", (target, expected) => {
    vi.stubEnv("BROWSER", target)
    installedWithId("unpacked-dev-build-id")
    expect(getReviewUrl()).toBe(expected)
  })
})
