import { useDifficultWordsAccess } from "@/utils/difficult-words/tab-state"

export const DIFFICULT_WORDS_ROUTE = "/difficult-words"

/**
 * Whether the settings show difficult words: while it is in testing, only to
 * the accounts it is open to, and on a failed check too, as the popup does.
 * Asked afresh once per settings page, where a new grant is looked for. Asked
 * with the feature switched off as well, since its switch is on its page.
 */
export function useIsDifficultWordsOpen() {
  const access = useDifficultWordsAccess(true, { fresh: true })
  return access.data === "allowed" || access.data === "unknown"
}
