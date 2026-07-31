/**
 * Migration script from v088 to v089
 * - Adds hover translation forceRetranslation with the existing default disabled.
 *
 * IMPORTANT: The default is hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants, helpers, or shared types.
 */
export function migrate(oldConfig: any): any {
  if (
    !oldConfig ||
    typeof oldConfig !== "object" ||
    Array.isArray(oldConfig) ||
    !oldConfig.translate ||
    typeof oldConfig.translate !== "object" ||
    Array.isArray(oldConfig.translate) ||
    !oldConfig.translate.node ||
    typeof oldConfig.translate.node !== "object" ||
    Array.isArray(oldConfig.translate.node)
  ) {
    return oldConfig
  }

  const forceRetranslation =
    typeof oldConfig.translate.node.forceRetranslation === "boolean"
      ? oldConfig.translate.node.forceRetranslation
      : false

  if (oldConfig.translate.node.forceRetranslation === forceRetranslation) {
    return oldConfig
  }

  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      node: {
        ...oldConfig.translate.node,
        forceRetranslation,
      },
    },
  }
}
