// @vitest-environment jsdom

import type { PageTranslationManager } from "../page-translation"
import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BLOCK_CONTENT_CLASS, INLINE_CONTENT_CLASS } from "@/utils/constants/dom-labels"

const mockDecorateTranslationNode = vi.hoisted(() => vi.fn<(...args: any[]) => any>())

vi.mock("@/utils/host/translate/ui/decorate-translation", () => ({
  decorateTranslationNode: mockDecorateTranslationNode,
}))

import { handleTranslationModeChange, handleTranslationStyleChange } from "../handle-config-change"

function createMockConfig(
  mode: "bilingual" | "translationOnly",
  preset: "dashedLine" | "border" = "dashedLine",
): Config {
  return {
    translate: {
      mode,
      translationNodeStyle: {
        preset,
        isCustom: false,
        customCSS: null,
      },
    },
  } as Config
}

function createMockManager(isActive: boolean) {
  const start = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined)
  const stop = vi.fn<(...args: any[]) => any>()
  const manager = {
    isActive,
    start,
    stop,
  } as unknown as PageTranslationManager

  return { manager, start, stop }
}

beforeEach(() => {
  document.body.innerHTML = ""
  mockDecorateTranslationNode.mockReset()
  mockDecorateTranslationNode.mockResolvedValue(undefined)
})

describe("handleTranslationModeChange", () => {
  it("should trigger re-translation when mode changes and manager is active", () => {
    const { manager, start, stop } = createMockManager(true)

    const didRestart = handleTranslationModeChange(
      createMockConfig("translationOnly"),
      createMockConfig("bilingual"),
      manager,
    )

    expect(stop).toHaveBeenCalled()
    expect(start).toHaveBeenCalled()
    expect(didRestart).toBeUndefined()
  })

  it("should not trigger when mode stays the same", () => {
    const { manager, stop } = createMockManager(true)

    handleTranslationModeChange(
      createMockConfig("bilingual"),
      createMockConfig("bilingual"),
      manager,
    )

    expect(stop).not.toHaveBeenCalled()
  })

  it("should not trigger when manager is not active", () => {
    const { manager, stop } = createMockManager(false)

    handleTranslationModeChange(
      createMockConfig("translationOnly"),
      createMockConfig("bilingual"),
      manager,
    )

    expect(stop).not.toHaveBeenCalled()
  })
})

describe("handleTranslationStyleChange", () => {
  it("re-decorates existing block and shadow-root translations when style changes", async () => {
    const block = document.createElement("span")
    block.className = BLOCK_CONTENT_CLASS
    document.body.appendChild(block)

    const host = document.createElement("div")
    const shadow = host.attachShadow({ mode: "open" })
    const inline = document.createElement("span")
    inline.className = INLINE_CONTENT_CLASS
    shadow.appendChild(inline)
    document.body.appendChild(host)

    const newStyle = createMockConfig("bilingual", "border").translate.translationNodeStyle
    await handleTranslationStyleChange(newStyle)

    expect(mockDecorateTranslationNode).toHaveBeenCalledTimes(2)
    expect(mockDecorateTranslationNode).toHaveBeenCalledWith(block, newStyle)
    expect(mockDecorateTranslationNode).toHaveBeenCalledWith(inline, newStyle)
  })

  it("serializes decoration so shared stylesheets are not replaced concurrently", async () => {
    const first = document.createElement("span")
    first.className = BLOCK_CONTENT_CLASS
    const second = document.createElement("span")
    second.className = BLOCK_CONTENT_CLASS
    document.body.append(first, second)

    let releaseFirst: (() => void) | undefined
    mockDecorateTranslationNode
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirst = resolve
          }),
      )
      .mockResolvedValueOnce(undefined)

    const style = createMockConfig("bilingual", "border").translate.translationNodeStyle
    const update = handleTranslationStyleChange(style)

    await vi.waitFor(() => expect(mockDecorateTranslationNode).toHaveBeenCalledTimes(1))
    releaseFirst?.()
    await update

    expect(mockDecorateTranslationNode).toHaveBeenNthCalledWith(1, first, style)
    expect(mockDecorateTranslationNode).toHaveBeenNthCalledWith(2, second, style)
  })
})
