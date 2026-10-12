/**
 * Migration script from v110 to v111.
 *
 * Changes no data. v111 lets an output field hold the text the reader
 * selected instead of something the model writes (`source: "selection"`):
 * the built-in Sentence Analysis and Improve Writing actions start with one,
 * and so does a custom action copied from them, so "save to notebase" keeps
 * the sentence their cards need.
 *
 * The CONFIG_SCHEMA_VERSION bump is what protects sync: an older build
 * refuses a v111 config instead of quietly dropping `source` (the schema
 * strips unknown keys), which turns the field into one the model writes, and
 * uploading the result.
 *
 * IMPORTANT: This is a frozen snapshot. It imports nothing from the evolving
 * application code.
 */
export function migrate(oldConfig: any): any {
  return oldConfig
}
