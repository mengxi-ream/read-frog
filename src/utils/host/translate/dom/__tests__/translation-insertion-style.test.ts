// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import type { TranslationNodeStyleConfig } from "@/types/config/translate"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  clearLiveTranslationNodeStyle,
  setLiveTranslationNodeStyle,
} from "../../ui/live-translation-style"

const mockDecorateTranslationNode = vi.hoisted(() => vi.fn<(...args: any[]) => any>())

vi.mock("@/utils/host/translate/ui/decorate-translation", () => ({
  decorateTranslationNode: mockDecorateTranslationNode,
}))

vi.mock("@/utils/site-rules/effective", () => ({
  getEffectiveSiteRule: () => ({
    forceBlockStyleSelector: null,
    forceInlineStyleSelector: null,
  }),
}))

import { insertTranslatedNodeIntoWrapper } from "../translation-insertion"

function createStyle(preset: "dashedLine" | "border"): TranslationNodeStyleConfig {
  return {
    preset,
    isCustom: false,
    customCSS: null,
  }
}

afterEach(() => {
  clearLiveTranslationNodeStyle()
  document.body.innerHTML = ""
  mockDecorateTranslationNode.mockReset()
})

describe("insertTranslatedNodeIntoWrapper live style", () => {
  it("uses the latest active style when an in-flight translation finishes", async () => {
    const source = document.createElement("p")
    const wrapper = document.createElement("span")
    document.body.append(source, wrapper)

    const requestedStyle = createStyle("dashedLine")
    const liveStyle = createStyle("border")
    setLiveTranslationNodeStyle(liveStyle)

    await insertTranslatedNodeIntoWrapper(
      wrapper,
      {
        flowSource: source,
        layoutSource: source,
        sourceText: "source",
      },
      "translated",
      requestedStyle,
      {} as Config,
      true,
    )

    expect(mockDecorateTranslationNode).toHaveBeenCalledWith(expect.any(HTMLElement), liveStyle)
  })
})
