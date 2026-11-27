import { afterEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import {
  getTabWithoutAccessPrompt,
  queryTabsWithoutAccessPrompt,
} from "../tabs-without-access-prompt"

describe("tab lookups that don't make Safari ask for website access", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each(["chrome", "edge", "firefox"])("queries tabs unchanged in %s", async (target) => {
    vi.stubEnv("BROWSER", target)
    // A spy takes the callback overload's type, so an implementation stands in
    // for mockResolvedValue.
    const query = vi.spyOn(browser.tabs, "query").mockImplementation(async () => [{ id: 1 }])

    await expect(
      queryTabsWithoutAccessPrompt({ active: true, currentWindow: true }),
    ).resolves.toEqual([{ id: 1 }])
    expect(query).toHaveBeenCalledExactlyOnceWith({ active: true, currentWindow: true })
  })

  it.each(["chrome", "edge", "firefox"])("gets the tab directly in %s", async (target) => {
    vi.stubEnv("BROWSER", target)
    const get = vi
      .spyOn(browser.tabs, "get")
      .mockImplementation(async () => ({ id: 7, url: "https://example.com/" }))

    await expect(getTabWithoutAccessPrompt(7)).resolves.toEqual({
      id: 7,
      url: "https://example.com/",
    })
    expect(get).toHaveBeenCalledExactlyOnceWith(7)
  })

  // A tab on a site Safari hasn't allowed never matches a `url` filter, so the
  // filter keeps Safari from asking about it.
  it("limits Safari's queries to web pages", async () => {
    vi.stubEnv("BROWSER", "safari")
    const query = vi.spyOn(browser.tabs, "query").mockImplementation(async () => [])

    await queryTabsWithoutAccessPrompt({ active: true, currentWindow: true })

    expect(query).toHaveBeenCalledExactlyOnceWith({
      active: true,
      currentWindow: true,
      url: "*://*/*",
    })
  })

  it("in Safari, looks the tab up among the ones it may access instead of getting it", async () => {
    vi.stubEnv("BROWSER", "safari")
    const query = vi.spyOn(browser.tabs, "query").mockImplementation(async () => [
      { id: 3, url: "https://example.com/" },
      { id: 7, url: "https://example.org/" },
    ])
    const get = vi.spyOn(browser.tabs, "get")

    await expect(getTabWithoutAccessPrompt(7)).resolves.toEqual({
      id: 7,
      url: "https://example.org/",
    })
    // On a site Safari hasn't allowed.
    await expect(getTabWithoutAccessPrompt(9)).resolves.toBeUndefined()
    expect(query).toHaveBeenCalledWith({ url: "*://*/*" })
    expect(get).not.toHaveBeenCalled()
  })
})
