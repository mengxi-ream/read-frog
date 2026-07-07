import type { ReactNode } from "react"
import i18next from "i18next"
import { useAtomValue } from "jotai"
import { Fragment } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { resolveUiLocale } from "./locale-map"

/**
 * Applies the configured UI language to the React subtree and re-renders it on change.
 *
 * Placement: MUST sit below the jotai `Provider`/`HydrateAtoms` and `QueryClientProvider`
 * of each entrypoint (jotai recreates its store per Provider instance, so re-keying above
 * it would wipe atom state), and above the page/app content.
 *
 * Mechanism: `i18next.changeLanguage` is synchronous with bundled resources, so we apply it
 * during render (guarded) and re-key the subtree on the RESOLVED locale. This makes the
 * remounted children paint in the new language on their first render — the reason we key on
 * the resolved locale (not the raw `uiLanguage`) is that "auto"→"en" and explicit "en" must
 * not trigger a spurious remount.
 */
export function LocaleBoundary({ children }: { children: ReactNode }) {
  const uiLanguage = useAtomValue(configFieldsAtomMap.uiLanguage)
  const resolvedLocale = resolveUiLocale(uiLanguage)

  if (i18next.language !== resolvedLocale) {
    // Synchronous with bundled resources; the returned promise is already resolved.
    void i18next.changeLanguage(resolvedLocale)
  }

  return <Fragment key={resolvedLocale}>{children}</Fragment>
}
