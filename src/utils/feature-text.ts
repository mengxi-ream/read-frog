import type { FeatureId } from "./features"
import { i18n } from "./i18n"

/** A simple mode feature's name, as its switch is labelled. */
export function getFeatureTitle(id: FeatureId): string {
  return i18n.t(`options.simpleMode.features.${id}.title`)
}

/** What a simple mode feature is, in a line: what turning it off takes away. */
export function getFeatureDescription(id: FeatureId): string {
  return i18n.t(`options.simpleMode.features.${id}.description`)
}
