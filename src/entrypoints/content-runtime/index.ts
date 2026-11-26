import "@/utils/zod-config"
import type { ContentRuntime, ContentRuntimePart } from "@/utils/content-runtime/parts"
import { ContentScriptContext, defineUnlistedScript } from "#imports"
import { createLogger } from "@/utils/logging/logger"
import { setupContentScriptLogging } from "@/utils/logging/setup"

const log = createLogger("content-runtime")

// The shared ES module behind the content scripts. The manifest only injects
// small loaders (entrypoints/loader.content.ts into every page,
// entrypoints/subtitles-loader.content.ts into video sites); they import this
// module from web_accessible_resources, so React, zod, i18next and the rest are
// bundled once instead of once per content script. wxt.config.ts builds it as
// an ES module with its own chunks.

type RunPart = (ctx: ContentScriptContext) => Promise<void>

// Each part is a chunk of its own, loaded when a loader asks for it: the frame
// of an embedded video player loads subtitles only, and a page with no video
// never loads them. What the parts share goes into chunks they all import.
const LOAD_PART: Record<ContentRuntimePart, () => Promise<RunPart>> = {
  host: async () => (await import("./host/main")).runHostContent,
  selection: async () => (await import("./selection/main")).runSelectionContent,
  side: async () => (await import("./side/main")).runSideContent,
  subtitles: async () => (await import("./subtitles/main")).runSubtitlesContent,
}

function isPartRunning(part: ContentRuntimePart) {
  if (part === "host") return window.__READ_FROG_HOST_INJECTED__ === true
  if (part === "selection") return window.__READ_FROG_SELECTION_INJECTED__ === true
  if (part === "subtitles") return window.__READ_FROG_SUBTITLES_INJECTED__ === true
  return false
}

// A part's own flag is set only once its chunk has loaded, so until then this
// keeps a second request for it from starting it again.
const startingParts = new Set<ContentRuntimePart>()

async function runPart(part: ContentRuntimePart) {
  // A new context with a running part's name would invalidate it
  if (isPartRunning(part) || startingParts.has(part)) return
  startingParts.add(part)
  try {
    const run = await LOAD_PART[part]()
    // Each part keeps the context name it had as its own content script,
    // so stopping old scripts and invalidation behave as before.
    await run(new ContentScriptContext(part, { cssInjectionMode: "manual" }))
  } catch (error) {
    log.error("Content part crashed on startup", { part, error })
  } finally {
    startingParts.delete(part)
  }
}

async function runContentParts(parts: readonly ContentRuntimePart[]) {
  await Promise.all(parts.map(runPart))
}

export default defineUnlistedScript((): ContentRuntime => {
  setupContentScriptLogging()
  return { runContentParts }
})
