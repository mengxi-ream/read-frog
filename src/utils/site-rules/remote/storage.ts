import { z } from "zod"
import { storage } from "#imports"
import { remoteSiteRulesDocumentSchema } from "./document"

export const REMOTE_SITE_RULES_STORAGE_KEY = "remoteSiteRules"

/** The latest verified document, plus when this install fetched it. */
export const storedRemoteSiteRulesSchema = remoteSiteRulesDocumentSchema.extend({
  fetchedAt: z.number(),
})

export type StoredRemoteSiteRules = z.infer<typeof storedRemoteSiteRulesSchema>

function parseStoredRemoteSiteRules(value: unknown): StoredRemoteSiteRules | null {
  const result = storedRemoteSiteRulesSchema.safeParse(value)
  return result.success ? result.data : null
}

export async function getStoredRemoteSiteRules(): Promise<StoredRemoteSiteRules | null> {
  return parseStoredRemoteSiteRules(await storage.getItem(`local:${REMOTE_SITE_RULES_STORAGE_KEY}`))
}

export async function setStoredRemoteSiteRules(value: StoredRemoteSiteRules): Promise<void> {
  await storage.setItem(`local:${REMOTE_SITE_RULES_STORAGE_KEY}`, value)
}

export function watchStoredRemoteSiteRules(
  callback: (value: StoredRemoteSiteRules | null) => void,
): () => void {
  return storage.watch(`local:${REMOTE_SITE_RULES_STORAGE_KEY}`, (value) => {
    callback(parseStoredRemoteSiteRules(value))
  })
}
