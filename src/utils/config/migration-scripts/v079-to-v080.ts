/**
 * Migration script from v079 to v080
 * - Adds customShortcut field to translate.node
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */

export function migrate(oldConfig: any): any {
  const translate = typeof oldConfig.translate === "object" && oldConfig.translate !== null && !Array.isArray(oldConfig.translate)
    ? oldConfig.translate
    : {}
  const node = typeof translate.node === "object" && translate.node !== null && !Array.isArray(translate.node)
    ? translate.node
    : {}

  return {
    ...oldConfig,
    translate: {
      ...translate,
      node: {
        ...node,
        customShortcut: node.customShortcut ?? "",
      },
    },
  }
}
