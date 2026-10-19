// Shared by the loader content script, the content runtime and the background,
// so it must stay free of imports: the loader is injected into every page.

/** The parts of the content runtime, each formerly its own content script. */
export const CONTENT_RUNTIME_PARTS = ["host", "selection", "side"] as const

export type ContentRuntimePart = (typeof CONTENT_RUNTIME_PARTS)[number]

/** The script the manifest injects into every page and the background into iframes. */
export const CONTENT_LOADER_SCRIPT_FILE = "/content-scripts/loader.js" as const

/** The shared ES module the loader imports; listed in web_accessible_resources. */
export const CONTENT_RUNTIME_MODULE_FILE = "/content-runtime.js" as const

// The background writes the parts an iframe needs here before it injects the
// loader; without it the loader runs every part, which only the top frame gets
// from the manifest.
export const CONTENT_RUNTIME_PARTS_WINDOW_KEY = "__READ_FROG_CONTENT_PARTS__" as const

declare global {
  interface Window {
    __READ_FROG_CONTENT_PARTS__?: ContentRuntimePart[]
  }
}

export interface ContentRuntime {
  runContentParts: (parts: readonly ContentRuntimePart[]) => Promise<void>
}
