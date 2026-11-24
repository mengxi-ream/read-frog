import type { Config } from "@/types/config/config"

/** The value at `Path` in `T`, or `never` when the path leaves `T`. */
type ValueAt<T, Path extends readonly string[]> = Path extends readonly [
  infer Key,
  ...infer Rest extends readonly string[],
]
  ? Key extends keyof T
    ? ValueAt<T[Key], Rest>
    : never
  : T

/** `Path` if it ends at a boolean in `Config`, which is what every feature switch is. */
type BooleanConfigPath<Path extends readonly string[]> = [ValueAt<Config, Path>] extends [never]
  ? never
  : [ValueAt<Config, Path>] extends [boolean]
    ? Path
    : never

function switchAt<const Path extends readonly string[]>(
  ...path: BooleanConfigPath<Path>
): BooleanConfigPath<Path> {
  return path
}

/**
 * Simple mode: every feature a user can turn off, and the one rule for what "off" means.
 *
 * A feature that is off behaves as if it were not installed. Nothing of it shows on web
 * pages, its shortcuts do nothing, it leaves the context menu and the popup, and its pages
 * leave the options sidebar. Its settings are kept, so turning it back on restores it as it
 * was.
 *
 * The id is the tree. "selectionToolbar.speak" sits under "selectionToolbar", so turning the
 * toolbar off turns its speak button off too, without touching the speak switch itself. The
 * order here is the order the switches are listed in, which follows the options sidebar.
 *
 * Code that shows or runs something tags it with the features it belongs to and asks
 * `isFeatureOn` / `isShown`. A nested feature has to go through them, since its own switch says
 * nothing about its parent's; a top-level feature's field can be read where code already holds
 * that part of the config, which is the same thing.
 */
export const FEATURES = {
  customActions: switchAt("customActions", "enabled"),
  pageTranslation: switchAt("pageTranslation", "enabled"),
  "pageTranslation.hover": switchAt("pageTranslation", "node", "enabled"),
  videoSubtitles: switchAt("videoSubtitles", "enabled"),
  inputTranslation: switchAt("inputTranslation", "enabled"),
  floatingButton: switchAt("floatingButton", "enabled"),
  selectionToolbar: switchAt("selectionToolbar", "enabled"),
  "selectionToolbar.annotation": switchAt("selectionToolbar", "annotation", "enabled"),
  "selectionToolbar.translate": switchAt("selectionToolbar", "features", "translate", "enabled"),
  "selectionToolbar.translate.noteSuggestion": switchAt(
    "selectionToolbar",
    "noteSuggestion",
    "enabled",
  ),
  "selectionToolbar.speak": switchAt("selectionToolbar", "features", "speak", "enabled"),
  contextMenu: switchAt("contextMenu", "enabled"),
  translationHub: switchAt("translationHub", "enabled"),
  glossary: switchAt("glossary", "enabled"),
} as const

export type FeatureId = keyof typeof FEATURES

export const FEATURE_IDS = Object.keys(FEATURES) as FeatureId[]

/** The feature one level up, or `undefined` for a top-level feature. */
export function parentOf(id: FeatureId): FeatureId | undefined {
  const dot = id.lastIndexOf(".")
  return dot === -1 ? undefined : (id.slice(0, dot) as FeatureId)
}

export function childrenOf(id: FeatureId): FeatureId[] {
  return FEATURE_IDS.filter((child) => parentOf(child) === id)
}

export const TOP_LEVEL_FEATURES = FEATURE_IDS.filter((id) => parentOf(id) === undefined)

/**
 * The feature's own switch, whatever its parent says. A switch a config has not got yet (one
 * stored before the migration that adds it) counts as on.
 */
export function isFeatureSwitchOn(config: Config, id: FeatureId): boolean {
  let value: unknown = config
  for (const key of FEATURES[id]) {
    value = (value as Record<string, unknown> | undefined)?.[key]
  }
  return value !== false
}

/** Whether the feature is there for the user: its own switch and every one above it are on. */
export function isFeatureOn(config: Config, id: FeatureId): boolean {
  const parent = parentOf(id)
  return isFeatureSwitchOn(config, id) && (parent === undefined || isFeatureOn(config, parent))
}

/**
 * A patch for `writeConfigAtom` that flips only this feature's own switch. Its children keep
 * their switches, so turning a parent back on brings them back as they were.
 */
export function setFeatureOn(id: FeatureId, on: boolean): Partial<Config> {
  return FEATURES[id].reduceRight<unknown>(
    (patch, key) => ({ [key]: patch }),
    on,
  ) as Partial<Config>
}

/** What a surface is tagged with: the features that all have to be on for it to show. */
export type FeatureTag = FeatureId | readonly FeatureId[]

function tagIds(tag: FeatureTag | undefined): readonly FeatureId[] {
  if (tag === undefined) {
    return []
  }
  return typeof tag === "string" ? [tag] : tag
}

export function isShown(config: Config, tag: FeatureTag | undefined): boolean {
  return tagIds(tag).every((id) => isFeatureOn(config, id))
}

/**
 * The switch that keeps a tagged surface hidden, which is the one to turn on to bring it back:
 * the highest switch that is off, through the tag's features in order. `undefined` while the
 * surface shows.
 */
export function switchedOffFeature(
  config: Config,
  tag: FeatureTag | undefined,
): FeatureId | undefined {
  for (const id of tagIds(tag)) {
    const chain: FeatureId[] = []
    for (let current: FeatureId | undefined = id; current; current = parentOf(current)) {
      chain.unshift(current)
    }
    const off = chain.find((feature) => !isFeatureSwitchOn(config, feature))
    if (off !== undefined) {
      return off
    }
  }
  return undefined
}
