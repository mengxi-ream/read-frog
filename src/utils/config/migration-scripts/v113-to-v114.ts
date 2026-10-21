/**
 * Migration script from v113 to v114.
 *
 * Changes no data. v114 lets a Notebase connection list the fields the reader
 * chose not to save (`skippedFieldIds`) and the undecided fields a save has
 * already reminded them about (`remindedFieldIds`). Both are optional, and a
 * missing list is an empty one: every field an older connection does not map
 * comes out undecided, so the next save reminds the reader about it once
 * instead of treating it as a choice they never made.
 *
 * The CONFIG_SCHEMA_VERSION bump is what protects sync: an older build
 * refuses a v114 config instead of quietly dropping the two lists (the schema
 * strips unknown keys) and uploading the result.
 *
 * IMPORTANT: This is a frozen snapshot. It imports nothing from the evolving
 * application code.
 */
export function migrate(oldConfig: any): any {
  return oldConfig
}
