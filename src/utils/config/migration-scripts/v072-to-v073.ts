/**
 * Migration script from v072 to v073
 * - Removes "lineByLine" from TRANSLATION_MODES, adds interleave field.
 *   Users with mode "lineByLine" are migrated to mode "bilingual" +
 *   interleave "sentence".
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
export function migrate(oldConfig: any): any {
  const oldMode = oldConfig?.translate?.mode
  const isLineByLine = oldMode === "lineByLine"

  return {
    ...oldConfig,
    translate: {
      ...oldConfig?.translate,
      mode: isLineByLine ? "bilingual" : (oldConfig?.translate?.mode ?? "bilingual"),
      interleave: isLineByLine ? "sentence" : (oldConfig?.translate?.interleave ?? "paragraph"),
    },
  }
}
