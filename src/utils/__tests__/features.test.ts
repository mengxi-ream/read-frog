import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"
import { mergeWithArrayOverwrite } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  childrenOf,
  FEATURE_IDS,
  isFeatureOn,
  isFeatureSwitchOn,
  isShown,
  parentOf,
  setFeatureOn,
  switchedOffFeature,
  TOP_LEVEL_FEATURES,
} from "../features"

function withFeatures(...patches: Partial<Config>[]): Config {
  return patches.reduce<Config>(
    (config, patch) => mergeWithArrayOverwrite(config, patch),
    DEFAULT_CONFIG,
  )
}

describe("feature tree", () => {
  it("reads parents and children off the dotted ids", () => {
    expect(parentOf("selectionToolbar.translate.noteSuggestion")).toBe("selectionToolbar.translate")
    expect(parentOf("selectionToolbar.translate")).toBe("selectionToolbar")
    expect(parentOf("selectionToolbar")).toBeUndefined()
    expect(childrenOf("selectionToolbar")).toEqual([
      "selectionToolbar.annotation",
      "selectionToolbar.translate",
      "selectionToolbar.speak",
    ])
    expect(childrenOf("pageTranslation")).toEqual(["pageTranslation.hover"])
    expect(childrenOf("glossary")).toEqual([])
  })

  it("lists the top level in sidebar order", () => {
    expect(TOP_LEVEL_FEATURES).toEqual([
      "customActions",
      "pageTranslation",
      "videoSubtitles",
      "inputTranslation",
      "floatingButton",
      "selectionToolbar",
      "contextMenu",
      "translationHub",
      "glossary",
    ])
  })

  it("has a parent for every dotted id", () => {
    const parents = FEATURE_IDS.flatMap((id) => parentOf(id) ?? [])
    expect(parents.filter((parent) => !FEATURE_IDS.includes(parent))).toEqual([])
  })
})

describe("isFeatureOn", () => {
  it("is on only while its own switch and every one above it are on", () => {
    const config = withFeatures(setFeatureOn("selectionToolbar", false))

    expect(isFeatureSwitchOn(config, "selectionToolbar.translate.noteSuggestion")).toBe(true)
    expect(isFeatureOn(config, "selectionToolbar.translate.noteSuggestion")).toBe(false)
    expect(isFeatureOn(config, "selectionToolbar.speak")).toBe(false)
    expect(isFeatureOn(config, "contextMenu")).toBe(true)

    const translateOff = withFeatures(setFeatureOn("selectionToolbar.translate", false))
    expect(isFeatureOn(translateOff, "selectionToolbar")).toBe(true)
    expect(isFeatureOn(translateOff, "selectionToolbar.translate.noteSuggestion")).toBe(false)
    expect(isFeatureOn(translateOff, "selectionToolbar.speak")).toBe(true)
  })

  it("counts a switch the config has not got yet as on", () => {
    const { customActions: _, ...rest } = DEFAULT_CONFIG
    const premigration = { ...rest, translationHub: {} } as unknown as Config

    expect(isFeatureOn(premigration, "customActions")).toBe(true)
    expect(isFeatureOn(premigration, "translationHub")).toBe(true)
  })
})

describe("setFeatureOn", () => {
  it("patches only the feature's own switch", () => {
    expect(setFeatureOn("selectionToolbar.speak", false)).toEqual({
      selectionToolbar: { features: { speak: { enabled: false } } },
    })
    expect(setFeatureOn("customActions", true)).toEqual({ customActions: { enabled: true } })

    const config = withFeatures(
      setFeatureOn("selectionToolbar.speak", false),
      setFeatureOn("selectionToolbar", false),
      setFeatureOn("selectionToolbar", true),
    )
    expect(isFeatureOn(config, "selectionToolbar.speak")).toBe(false)
    expect(isFeatureOn(config, "selectionToolbar.translate")).toBe(true)
    expect(config.selectionToolbar.customActions).toEqual(
      DEFAULT_CONFIG.selectionToolbar.customActions,
    )
  })
})

describe("isShown", () => {
  it("shows an untagged surface, and a tagged one while all its features are on", () => {
    const config = withFeatures(setFeatureOn("customActions", false))

    expect(isShown(config, undefined)).toBe(true)
    expect(isShown(config, "contextMenu")).toBe(true)
    expect(isShown(config, ["contextMenu", "customActions"])).toBe(false)
    expect(isShown(config, [])).toBe(true)
  })
})

describe("switchedOffFeature", () => {
  it("names the highest switch that is off, through the tag's features in order", () => {
    const config = withFeatures(
      setFeatureOn("selectionToolbar.translate", false),
      setFeatureOn("selectionToolbar.translate.noteSuggestion", false),
      setFeatureOn("customActions", false),
    )

    expect(switchedOffFeature(config, "selectionToolbar.translate.noteSuggestion")).toBe(
      "selectionToolbar.translate",
    )
    expect(switchedOffFeature(config, ["selectionToolbar", "customActions"])).toBe("customActions")
    expect(switchedOffFeature(config, "selectionToolbar.speak")).toBeUndefined()
    expect(switchedOffFeature(config, undefined)).toBeUndefined()

    const toolbarOff = withFeatures(config, setFeatureOn("selectionToolbar", false))
    expect(switchedOffFeature(toolbarOff, "selectionToolbar.translate.noteSuggestion")).toBe(
      "selectionToolbar",
    )
  })
})
