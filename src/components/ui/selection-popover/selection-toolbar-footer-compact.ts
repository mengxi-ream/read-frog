// The selection toolbar footer is a size container named `footer` once it
// holds extra controls. Below this width its labelled controls collapse to
// icons, because at 320px the Save to Notebase label alone is wider than the
// footer in some locales. Above it, labels truncate instead. The threshold is
// in px: a rem condition in a content script would scale with the host page's
// root font size.
export const SELECTION_TOOLBAR_FOOTER_COMPACT_CLASSES = {
  /** Hides a label from sight in a narrow footer; screen readers still read it. */
  label: "@max-[416px]/footer:sr-only",
  /** Shows the icon that stands in for a hidden label. */
  icon: "hidden @max-[416px]/footer:block",
  /** Squares a button whose label is hidden, to match the icon buttons. */
  button: "@max-[416px]/footer:w-7 @max-[416px]/footer:px-0",
} as const
