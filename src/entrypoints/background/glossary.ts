import type { LanguageTag } from "@read-frog/definitions"
import type { GlossarySnapshot } from "@/utils/glossary/active-matcher"
import { resolveLanguage } from "@read-frog/definitions"
import { setGlossarySnapshotLoader } from "@/utils/glossary/active-matcher"
import {
  getGlossaryRevision,
  listGlossaries,
  loadGlossaryEntries,
} from "@/utils/glossary/repository"
import { isGlossaryActiveForUrl } from "@/utils/glossary/scope"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"

const EMPTY_SNAPSHOT: GlossarySnapshot = { revision: 0, scopeKey: "", entries: [] }

/**
 * Serves the glossary to content scripts, which cannot open the extension's
 * IndexedDB themselves (their `indexedDB` belongs to the host page's origin).
 *
 * One call per page, not per paragraph — see `utils/glossary/active-matcher.ts`.
 * A failure resolves to an empty snapshot rather than rejecting: a broken
 * glossary must degrade to "translate without it", never to a failed page.
 */
async function readSnapshot(
  url: string | undefined,
  targetLang: LanguageTag,
): Promise<GlossarySnapshot> {
  const [revision, glossaries, entries] = await Promise.all([
    getGlossaryRevision(),
    listGlossaries(),
    loadGlossaryEntries(targetLang, url),
  ])
  // Already in list order, so this is stable for a given set.
  const scopeKey = glossaries
    .filter((glossary) => isGlossaryActiveForUrl(glossary, url))
    .map((glossary) => glossary.id)
    .join(",")
  return { revision, scopeKey, entries }
}

export function setupGlossaryMessageHandlers() {
  // The background reads the database directly — it cannot message itself, and
  // it is the context that builds the prompt actually sent to the provider.
  //
  // It passes no URL: the background serves every tab at once, so it has no one
  // page to scope by. Only glossaries that apply everywhere reach a prompt
  // resolved here, and every request that CAN name its page carries the terms
  // its own page resolved (see `TranslatePromptOptions.glossaryTerms`), so this
  // path is a fallback rather than the normal route.
  setGlossarySnapshotLoader((_url, targetLang) => readSnapshot(undefined, targetLang))

  onMessage("getGlossarySnapshot", async ({ data }): Promise<GlossarySnapshot> => {
    try {
      // A content script from before tags, still running after an update, sends
      // an ISO 639-3 code, while the stored terms are keyed by tag now.
      return await readSnapshot(data.url, resolveLanguage(data.targetLang) ?? data.targetLang)
    } catch (error) {
      logger.error("Failed to build glossary snapshot", error)
      return EMPTY_SNAPSHOT
    }
  })
}
