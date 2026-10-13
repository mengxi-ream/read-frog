import { describe, expect, it } from "vitest"
import { configSchema } from "@/types/config/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { migrate } from "../../migration-scripts/v110-to-v111"

describe("v110-to-v111 migration", () => {
  it("changes nothing: v111 only allows a new optional key", () => {
    const config = { selectionToolbar: { customActions: [{ id: "custom-1", name: "Mine" }] } }
    expect(migrate(config)).toBe(config)
  })

  it("keeps a selection field, which the v111 schema accepts", () => {
    const customAction = {
      id: "custom-1",
      name: "Sentence Analysis",
      enabled: true,
      icon: "tabler:sparkles",
      providerId: DEFAULT_CONFIG.selectionToolbar.customActions[0]?.providerId ?? "openai-default",
      systemPrompt: "",
      prompt: "{{selection}}",
      outputSchema: [
        { id: "sentence", name: "Sentence", type: "string", description: "", source: "selection" },
        { id: "annotations", name: "Annotations", type: "string", description: "" },
      ],
    }
    const config = {
      ...DEFAULT_CONFIG,
      selectionToolbar: { ...DEFAULT_CONFIG.selectionToolbar, customActions: [customAction] },
    }
    const parsed = configSchema.safeParse(migrate(structuredClone(config)))
    expect(parsed.success).toBe(true)
    expect(parsed.data?.selectionToolbar.customActions[0]?.outputSchema[0]?.source).toBe(
      "selection",
    )
  })
})
