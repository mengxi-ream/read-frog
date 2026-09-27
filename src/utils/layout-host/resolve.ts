import { DEFAULT_LAYOUT } from "@read-frog/layout-engine/presets"

// The layout source an action renders with. `layout` is optional in the config
// schema, and a missing or blank one means "the default field list". Kept
// liquidjs-free: it runs in the popup before the engine is needed.
export function resolveActionLayout(action: { layout?: string | null }): string {
  const { layout } = action
  return typeof layout === "string" && layout.trim() !== "" ? layout : DEFAULT_LAYOUT
}
