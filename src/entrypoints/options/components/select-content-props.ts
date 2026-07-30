/**
 * Every select on a settings page belongs to a `ConfigItem` row, where the trigger hugs its
 * content and sits at the right edge of the control column. Aligning the popup to that edge
 * keeps it over its own trigger instead of drifting left under the row's description.
 *
 * Pass to `SelectContent` (or `ProviderSelector`'s `selectContentProps`) wherever a settings
 * page opens a select. Pages that predate this still use the centered default; they adopt it
 * as they are refactored.
 */
export const SELECT_CONTENT_PROPS = { align: "end" } as const
