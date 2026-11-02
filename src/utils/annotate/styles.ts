// The styles a page gets for annotations: a ::highlight() rule for the marks
// and a ladder of line-heights the glosses can ask for. Both go in the host
// document through adoptedStyleSheets, as the translation preset styles do,
// never as inline styles: page translation's mutation observer watches
// `style` on host blocks, and a data attribute is not a record it sees.

/** The one registered highlight. Page-global namespace, so prefixed. */
export const ANNOTATION_HIGHLIGHT_NAME = "read-frog-annotation"

/** On the element whose line-height the gloss needs taller; see leading.ts. */
export const ANNOTATION_LEADING_ATTRIBUTE = "data-read-frog-gloss-lh"

/** On the layer's host element, so text walkers can leave it out. */
export const ANNOTATION_HOST_ATTRIBUTE = "data-read-frog-annotation-layer"

/** The bilingual "textColor" preset's green (assets/styles/custom-translation-node.css), so marks read as the same family. */
export const UNDERLINE_COLOR = "oklch(0.693 0.17 162.48)"
export const UNDERLINE_OFFSET_PX = 3
/** Between the underline and the gloss. */
export const GLOSS_GAP_PX = 1
export const GLOSS_FONT_PX = 11
export const GLOSS_LINE_PX = 13

/** The ladder's rungs, in tenths of the font size: 1.4 to 4.0. */
export const LEADING_LADDER_MIN = 14
export const LEADING_LADDER_MAX = 40

export function buildAnnotationDocumentCss(): string {
  const rules = [
    // No skip-ink: a mark that breaks around every descender reads as broken.
    `::highlight(${ANNOTATION_HIGHLIGHT_NAME}) { text-decoration: underline 1.5px ${UNDERLINE_COLOR}; text-underline-offset: ${UNDERLINE_OFFSET_PX}px; text-decoration-skip-ink: none; }`,
  ]
  // `!important` so the rung also beats a line-height the page set inline.
  // Unitless, so an inline child with its own font size scales with it.
  for (let rung = LEADING_LADDER_MIN; rung <= LEADING_LADDER_MAX; rung += 1) {
    rules.push(
      `[${ANNOTATION_LEADING_ATTRIBUTE}="${rung}"] { line-height: ${(rung / 10).toFixed(1)} !important; }`,
    )
  }
  return rules.join("\n")
}

let documentSheet: CSSStyleSheet | null = null

export function ensureAnnotationDocumentStyles(): void {
  if (!documentSheet) {
    documentSheet = new CSSStyleSheet()
    documentSheet.replaceSync(buildAnnotationDocumentCss())
  }
  if (!document.adoptedStyleSheets.includes(documentSheet)) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, documentSheet]
  }
}

export function removeAnnotationDocumentStyles(): void {
  if (!documentSheet) return
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
    (sheet) => sheet !== documentSheet,
  )
}

/**
 * The layer's own styles, in its shadow root. The gloss takes the block's
 * text colour (`--c`), a little faded, so it reads on the page's own
 * background in either theme; the underline keeps one colour.
 */
export const LAYER_CSS = `
.layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  pointer-events: none;
  font: ${GLOSS_FONT_PX}px/${GLOSS_LINE_PX}px system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif;
}
.a {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  pointer-events: none;
  color: var(--c, #333);
  /* The remove button's greys are the design system's (theme.css: --rf-muted,
     --rf-border, --rf-muted-foreground, and their hover steps), written out
     because this root is outside the extension's theme stylesheet. These are
     the light values; a block with light text on a dark page gets the .dark
     ones below. */
  --x-bg: oklch(97% 0 none);
  --x-bg-hover: oklch(92.2% 0 none);
  --x-border: oklch(92.2% 0 none);
  --x-fg: oklch(55.6% 0 none);
  --x-fg-hover: oklch(37.1% 0 none);
}
.a[data-tone="dark"] {
  --x-bg: oklch(26.9% 0 none);
  --x-bg-hover: oklch(37.1% 0 none);
  --x-border: oklch(1 0 0 / 10%);
  --x-fg: oklch(70.8% 0 none);
  --x-fg-hover: oklch(92.2% 0 none);
}
.u {
  position: absolute;
  top: 0;
  left: 0;
  height: 6px;
  box-sizing: border-box;
  /* Drawn, never hit: hovering the text is tracked from the pointer (see layer.ts). */
  pointer-events: none;
}
.layer.fallback .u {
  border-top: 1.5px solid ${UNDERLINE_COLOR};
}
.g {
  position: absolute;
  top: 0;
  left: 0;
  height: ${GLOSS_LINE_PX}px;
  overflow: hidden;
  pointer-events: auto;
  white-space: nowrap;
  opacity: 0.82;
}
.g.clip {
  mask-image: linear-gradient(to right, #000 calc(100% - 10px), transparent);
  -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 10px), transparent);
}
.g.swap {
  transition: width 0.18s ease-out, transform 0.18s ease-out;
}
.t {
  display: block;
  width: max-content;
  margin: 0 auto;
  font: inherit;
  line-height: ${GLOSS_LINE_PX}px;
  opacity: 1;
  transition: opacity 0.15s ease-out;
}
.g.loading .t {
  opacity: 0;
}
/* While the meaning is on its way: the design system's skeleton (a muted,
   rounded bar that pulses), as wide as the word it stands under. */
.sk {
  display: none;
  position: absolute;
  left: 1px;
  right: 1px;
  top: 2px;
  height: ${GLOSS_LINE_PX - 4}px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--c, #333) 16%, transparent);
  animation: rf-skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.g.loading .sk {
  display: block;
}
@keyframes rf-skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.x {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  width: 14px;
  height: 14px;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--x-border);
  border-radius: 7px;
  background: var(--x-bg);
  color: var(--x-fg);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s, background-color 0.12s, color 0.12s;
}
.x svg {
  display: block;
  width: 8px;
  height: 8px;
}
.x:hover {
  background: var(--x-bg-hover);
  color: var(--x-fg-hover);
}
/* Hover is kept by script, with a grace period, so the pointer can cross the
   gap from the gloss to the button without the button vanishing. */
.a.hover .x,
.x:focus-visible {
  opacity: 1;
  pointer-events: auto;
}
@media (prefers-reduced-motion: reduce) {
  .sk { animation: none; }
  .g.swap, .t { transition: none; }
}
`
