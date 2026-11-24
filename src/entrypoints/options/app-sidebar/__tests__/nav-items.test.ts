import { describe, expect, it } from "vitest"
import { getRouteFeature, ROUTE_DEFS } from "../nav-items"

describe("which options pages simple mode takes away", () => {
  it("keeps Page Translation's pages while it is off, since other features use their settings", () => {
    const pageTranslationPaths = ROUTE_DEFS.map(({ path }) => path).filter((path) =>
      path.startsWith("/page-translation"),
    )

    expect(pageTranslationPaths).toContain("/page-translation/prompts")
    expect(pageTranslationPaths).toContain("/page-translation/translation-queue")
    for (const path of pageTranslationPaths) {
      expect(getRouteFeature(path)).toBeUndefined()
    }
  })

  it("takes away the pages of the other features that are off", () => {
    expect(getRouteFeature("/video-subtitles")).toBe("videoSubtitles")
    expect(getRouteFeature("/video-subtitles/prompts")).toBe("videoSubtitles")
    expect(getRouteFeature("/selection-toolbar")).toBe("selectionToolbar")
    expect(getRouteFeature("/advanced/glossary")).toBe("glossary")
  })
})
