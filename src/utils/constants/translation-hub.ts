// The Translation Hub lives at its own extension page. Every entry point
// (popup button, options sidebar, keyboard shortcut) opens this path.
export const TRANSLATION_HUB_PAGE_PATH = "/translation-hub.html"

// Three keys on purpose: the hub is opened far less often than the reading
// shortcuts, so it takes the roomier `Alt+Shift+` prefix rather than a bare
// `Alt+<letter>` that users would rather keep for something else.
export const DEFAULT_TRANSLATION_HUB_SHORTCUT_KEY = "Alt+Shift+H"
