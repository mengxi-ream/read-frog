import "@/utils/zod-config"
import type { ContentRuntime, ContentRuntimePart } from "@/utils/content-runtime/parts"
import { ContentScriptContext, defineUnlistedScript } from "#imports"
import { logger } from "@/utils/logger"
import { runHostContent } from "../host.content/main"
import { runSelectionContent } from "../selection.content/main"
import { runSideContent } from "../side.content/main"

// The shared ES module behind every page's content scripts. The manifest only
// injects the small loader (entrypoints/loader.content.ts); it imports this
// module from web_accessible_resources, so React, zod, i18next and the rest are
// bundled once instead of once per content script. wxt.config.ts builds it as
// an ES module with its own chunks.

const RUNNERS: Record<ContentRuntimePart, (ctx: ContentScriptContext) => Promise<void>> = {
  host: runHostContent,
  selection: runSelectionContent,
  side: runSideContent,
}

function isPartRunning(part: ContentRuntimePart) {
  if (part === "host") return window.__READ_FROG_HOST_INJECTED__ === true
  if (part === "selection") return window.__READ_FROG_SELECTION_INJECTED__ === true
  return false
}

async function runContentParts(parts: readonly ContentRuntimePart[]) {
  await Promise.all(
    parts
      // A new context with a running part's name would invalidate it
      .filter((part) => !isPartRunning(part))
      .map(async (part) => {
        try {
          // Each part keeps the context name it had as its own content script,
          // so stopping old scripts and invalidation behave as before.
          await RUNNERS[part](new ContentScriptContext(part, { cssInjectionMode: "manual" }))
        } catch (error) {
          logger.error(`[content-runtime] "${part}" crashed on startup`, error)
        }
      }),
  )
}

export default defineUnlistedScript((): ContentRuntime => ({ runContentParts }))
