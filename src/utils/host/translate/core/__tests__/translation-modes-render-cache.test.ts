// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CONTENT_WRAPPER_CLASS } from "@/utils/constants/dom-labels"
import { MOCK_ORIGINAL_TEXT, MOCK_TRANSLATION } from "@/utils/host/__tests__/utils"
import { flushBatchedOperations } from "@/utils/host/dom/batch-dom"
import { translateTextForPage } from "@/utils/host/translate/translate-variants"
import { translateNodesBilingualMode } from "../translation-modes"
import { clearBilingualRenderCache } from "../translation-render-cache"

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPage: vi.fn(() => Promise.resolve(MOCK_TRANSLATION)),
}))

vi.mock("@/utils/host/translate/filter-small-paragraph", () => ({
  shouldFilterSmallParagraph: vi.fn(() => Promise.resolve(false)),
}))

function createBilingualConfig(): Config {
  return {
    ...DEFAULT_CONFIG,
    translate: {
      ...DEFAULT_CONFIG.translate,
      mode: "bilingual",
      page: {
        ...DEFAULT_CONFIG.translate.page,
        minCharactersPerNode: 0,
        minWordsPerNode: 0,
      },
    },
  }
}

function createAIContentAwareBilingualConfig(): Config {
  const config = createBilingualConfig()
  return {
    ...config,
    translate: {
      ...config.translate,
      enableAIContentAware: true,
    },
  }
}

function createTextNode(text: string): Text {
  return document.createTextNode(text)
}

async function translateTextNode(textNode: Text, walkId: string, config: Config) {
  await translateNodesBilingualMode([textNode], walkId, config)
  flushBatchedOperations()
}

describe("translateNodesBilingualMode render cache", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    clearBilingualRenderCache()
    vi.mocked(translateTextForPage).mockClear()
    vi.mocked(translateTextForPage).mockResolvedValue(MOCK_TRANSLATION)
  })

  it("uses spinner and translateTextForPage on cache miss", async () => {
    const container = document.createElement("div")
    const textNode = createTextNode(MOCK_ORIGINAL_TEXT)
    container.appendChild(textNode)
    document.body.appendChild(container)

    await translateTextNode(textNode, "walk-1", createBilingualConfig())

    const wrapper = container.querySelector(`.${CONTENT_WRAPPER_CLASS}`)
    expect(wrapper).not.toBeNull()
    expect(wrapper?.querySelector(".read-frog-spinner")).toBeNull()
    expect(translateTextForPage).toHaveBeenCalledOnce()
    expect(translateTextForPage).toHaveBeenCalledWith(MOCK_ORIGINAL_TEXT)
  })

  it("skips spinner and translateTextForPage on cache hit for replacement nodes", async () => {
    const config = createBilingualConfig()
    const container = document.createElement("div")
    document.body.appendChild(container)

    const firstTextNode = createTextNode(MOCK_ORIGINAL_TEXT)
    container.appendChild(firstTextNode)
    await translateTextNode(firstTextNode, "walk-1", config)

    expect(translateTextForPage).toHaveBeenCalledOnce()

    container.innerHTML = ""
    const replacementTextNode = createTextNode(MOCK_ORIGINAL_TEXT)
    container.appendChild(replacementTextNode)

    await translateTextNode(replacementTextNode, "walk-2", config)

    expect(translateTextForPage).toHaveBeenCalledOnce()

    const wrapper = container.querySelector(`.${CONTENT_WRAPPER_CLASS}`)
    expect(wrapper).not.toBeNull()
    expect(wrapper?.querySelector(".read-frog-spinner")).toBeNull()
    expect(wrapper?.textContent).toContain(MOCK_TRANSLATION)
  })

  it("does not cache empty display translations", async () => {
    vi.mocked(translateTextForPage).mockResolvedValue(MOCK_ORIGINAL_TEXT)

    const config = createBilingualConfig()
    const container = document.createElement("div")
    document.body.appendChild(container)

    const firstTextNode = createTextNode(MOCK_ORIGINAL_TEXT)
    container.appendChild(firstTextNode)
    await translateTextNode(firstTextNode, "walk-1", config)

    expect(container.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()
    expect(translateTextForPage).toHaveBeenCalledOnce()

    container.innerHTML = ""
    const replacementTextNode = createTextNode(MOCK_ORIGINAL_TEXT)
    container.appendChild(replacementTextNode)
    await translateTextNode(replacementTextNode, "walk-2", config)

    expect(translateTextForPage).toHaveBeenCalledTimes(2)
  })

  it("does not use render cache when AI content-aware translation is enabled", async () => {
    const config = createAIContentAwareBilingualConfig()
    const container = document.createElement("div")
    document.body.appendChild(container)

    const firstTextNode = createTextNode(MOCK_ORIGINAL_TEXT)
    container.appendChild(firstTextNode)
    await translateTextNode(firstTextNode, "walk-1", config)

    container.innerHTML = ""
    const replacementTextNode = createTextNode(MOCK_ORIGINAL_TEXT)
    container.appendChild(replacementTextNode)
    await translateTextNode(replacementTextNode, "walk-2", config)

    expect(translateTextForPage).toHaveBeenCalledTimes(2)
  })
})
