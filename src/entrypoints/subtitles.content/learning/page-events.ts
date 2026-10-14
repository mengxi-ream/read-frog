const SUBTITLE_LINE_SELECTOR = '[data-slot="subtitle-line"]'

export function isFromSubtitleLine(event: Event) {
  return event
    .composedPath()
    .some((node) => node instanceof Element && node.matches(SUBTITLE_LINE_SELECTOR))
}
