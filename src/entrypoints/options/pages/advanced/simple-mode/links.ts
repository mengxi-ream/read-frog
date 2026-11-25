import type { Config } from "@/types/config/config"
import type { FeatureId, FeatureTag } from "@/utils/features"
import { switchedOffFeature } from "@/utils/features"
import { getSimpleModeRowId, SIMPLE_MODE_PATH } from "@/utils/navigation"
import { buildSectionLink } from "../../../command-palette/section-scroll"

export function buildSimpleModeRowLink(id: FeatureId) {
  return buildSectionLink(SIMPLE_MODE_PATH, getSimpleModeRowId(id))
}

/**
 * Where to bring back something simple mode has hidden: the simple mode row of the switch that
 * hides it. `undefined` while it shows.
 */
export function buildTurnOnLink(config: Config, tag: FeatureTag | undefined) {
  const off = switchedOffFeature(config, tag)
  return off === undefined ? undefined : buildSimpleModeRowLink(off)
}
