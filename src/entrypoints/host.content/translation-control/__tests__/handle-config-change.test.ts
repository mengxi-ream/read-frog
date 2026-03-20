import type { PageTranslationManager } from "../page-translation"
import type { Config } from "@/types/config/config"
import { describe, expect, it, vi } from "vitest"
import { handleTranslationModeChange } from "../handle-config-change"

function createMockConfig(mode: "bilingual" | "translationOnly"): Config {
  return { translate: { mode } } as Config
}

function createMockManager(isActive: boolean): PageTranslationManager {
  return {
    isActive,
    setEnabled: vi.fn().mockResolvedValue(undefined),
  } as unknown as PageTranslationManager
}

describe("handleTranslationModeChange", () => {
  it("should trigger re-translation when mode changes and manager is active", () => {
    const manager = createMockManager(true)

    handleTranslationModeChange(
      createMockConfig("translationOnly"),
      createMockConfig("bilingual"),
      manager,
    )

    expect(manager.setEnabled).toHaveBeenNthCalledWith(1, false)
    expect(manager.setEnabled).toHaveBeenNthCalledWith(2, true)
  })

  it("should not trigger when mode stays the same", () => {
    const manager = createMockManager(true)

    handleTranslationModeChange(
      createMockConfig("bilingual"),
      createMockConfig("bilingual"),
      manager,
    )

    expect(manager.setEnabled).not.toHaveBeenCalled()
  })

  it("should not trigger when manager is not active", () => {
    const manager = createMockManager(false)

    handleTranslationModeChange(
      createMockConfig("translationOnly"),
      createMockConfig("bilingual"),
      manager,
    )

    expect(manager.setEnabled).not.toHaveBeenCalled()
  })
})
