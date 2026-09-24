import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { migrate } from "../../migration-scripts/v101-to-v102"

describe("v101 to v102 migration", () => {
  it("preserves the shortcut and seeds an independent Hub prompt", () => {
    const oldConfig = {
      translationHub: { shortcut: "Alt+Shift+H" },
      pageTranslation: { customPromptsConfig: { promptId: "custom-prompt" } },
    }

    expect(migrate(oldConfig).translationHub).toEqual({
      shortcut: "Alt+Shift+H",
      selectedProviderIds: null,
      sourceCode: null,
      targetCode: null,
      promptId: "custom-prompt",
    })
    expect(migrate(migrate(oldConfig))).toEqual(migrate(oldConfig))
  })

  it("uses the default prompt when the old selection is missing", () => {
    expect(migrate({ translationHub: { shortcut: "" } }).translationHub.promptId).toBe("default")
  })

  it("parses an older Hub section without replacing unrelated settings", () => {
    const parsed = configSchema.parse({
      ...DEFAULT_CONFIG,
      uiLanguage: "zh-CN",
      pageTranslation: {
        ...DEFAULT_CONFIG.pageTranslation,
        customPromptsConfig: {
          ...DEFAULT_CONFIG.pageTranslation.customPromptsConfig,
          promptId: "precision-rewrite",
        },
      },
      translationHub: { shortcut: "Alt+Shift+H" },
    })
    expect(parsed.uiLanguage).toBe("zh-CN")
    expect(parsed.translationHub).toMatchObject({
      shortcut: "Alt+Shift+H",
      selectedProviderIds: null,
      sourceCode: null,
      targetCode: null,
      promptId: null,
    })
    expect(migrate(parsed).translationHub.promptId).toBe("precision-rewrite")
  })
})
