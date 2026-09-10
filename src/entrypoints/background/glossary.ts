import type { GlossarySnapshot } from "@/utils/glossary/active-matcher"
import { setGlossarySnapshotLoader } from "@/utils/glossary/active-matcher"
import { getGlossaryRevision, loadGlossaryEntries } from "@/utils/glossary/repository"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"

/**
 * Serves the glossary to content scripts, which cannot open the extension's
 * IndexedDB themselves (their `indexedDB` belongs to the host page's origin).
 *
 * One call per page, not per paragraph — see `utils/glossary/active-matcher.ts`.
 * A failure resolves to an empty snapshot rather than rejecting: a broken
 * glossary must degrade to "translate without it", never to a failed page.
 */
async function readSnapshot(): Promise<GlossarySnapshot> {
  const [revision, entries] = await Promise.all([getGlossaryRevision(), loadGlossaryEntries()])
  return { revision, entries }
}

export function setupGlossaryMessageHandlers() {
  // The background reads the database directly — it cannot message itself, and
  // it is the context that builds the prompt actually sent to the provider.
  setGlossarySnapshotLoader(readSnapshot)

  onMessage("getGlossarySnapshot", async (): Promise<GlossarySnapshot> => {
    try {
      return await readSnapshot()
    } catch (error) {
      logger.error("Failed to build glossary snapshot", error)
      return { revision: 0, entries: [] }
    }
  })
}
