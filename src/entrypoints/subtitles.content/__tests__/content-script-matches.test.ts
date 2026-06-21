import { describe, expect, it } from "vitest"
import { subtitlesContentScriptMatches } from "../content-script-matches"

describe("subtitles content script matches", () => {
  it("loads on x.com timeline pages so SPA navigation into a status page can initialize subtitles", () => {
    expect(subtitlesContentScriptMatches).toEqual(expect.arrayContaining([
      "*://x.com/*",
      "*://*.x.com/*",
      "*://twitter.com/*",
      "*://*.twitter.com/*",
    ]))
  })
})
