/**
 * Migration script from v086 to v087
 * - Adds `translate.vocabulary` ({ familiarWordRank: 5000 }): configuration for
 *   the vocabulary translation mode (inline parenthesized glosses for words
 *   beyond the user's familiar frequency rank).
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object") {
    return oldConfig
  }

  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      vocabulary: oldConfig.translate?.vocabulary ?? { familiarWordRank: 5000 },
    },
  }
}
