import { browser } from "#imports";

/**
 * Key used in browser.storage.local to persist translation state per tab.
 */
const STORAGE_KEY = "translationState";

/**
 * Load the entire translation state map from storage.
 * @returns A record mapping tab id strings to a boolean indicating whether the tab has been translated.
 */
async function loadState(): Promise<Record<string, boolean>> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as Record<string, boolean>) ?? {};
}

/**
 * Persist the entire translation state map to storage.
 * @param state The state map to store.
 */
async function saveState(state: Record<string, boolean>): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

/**
 * Mark a tab as translated or not translated.
 * @param tabId The id of the tab.
 * @param translated Whether the tab has been translated.
 */
export async function setTranslationState(tabId: number, translated: boolean): Promise<void> {
  const state = await loadState();
  state[tabId.toString()] = translated;
  await saveState(state);
}

/**
 * Query whether a tab has been translated.
 * @param tabId The id of the tab.
 * @returns `true` if the tab has been translated, `false` if not, or `undefined` if unknown.
 */
export async function getTranslationState(tabId: number): Promise<boolean | undefined> {
  const state = await loadState();
  return state[tabId.toString()];
}

/**
 * Remove the translation state for a specific tab.
 * Useful when a tab is closed or when the state should be reset.
 * @param tabId The id of the tab.
 */
export async function clearTranslationState(tabId: number): Promise<void> {
  const state = await loadState();
  delete state[tabId.toString()];
  await saveState(state);
}

/**
 * Clear all translation state entries.
 * This can be used during debugging or when a full reset is required.
 */
export async function clearAllTranslationState(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEY);
}
