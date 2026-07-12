import type { PageTranslationManager } from "../page-translation"
import type { Config } from "@/types/config/config"
import { describe, expect, it, vi } from "vitest"
import { handleTranslationModeChange } from "../handle-config-change"

function createMockConfig(mode: "bilingual" | "translationOnly"): Config {
  return { translate: { mode } } as Config
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

describe("handleTranslationModeChange", () => {
  it("should trigger re-translation when mode changes and manager is active", () => {
    const { manager, start, stop } = createMockManager(true)

    handleTranslationModeChange(
      createMockConfig("translationOnly"),
      createMockConfig("bilingual"),
      manager,
    )

    expect(stop).toHaveBeenCalled()
    expect(start).toHaveBeenCalled()
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
