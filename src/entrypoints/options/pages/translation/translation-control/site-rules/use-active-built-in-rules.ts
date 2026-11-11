import type { SiteRule } from "@/types/config/site-rules"
import { useEffect, useSyncExternalStore } from "react"
import {
  ensureRemoteSiteRulesLoaded,
  getActiveBuiltInSiteRules,
  subscribeActiveBuiltInSiteRules,
} from "@/utils/site-rules/active"

/** The built-in rules pages run with, remote updates included, so each can be switched off. */
export function useActiveBuiltInSiteRules(): SiteRule[] {
  useEffect(() => {
    void ensureRemoteSiteRulesLoaded()
  }, [])
  return useSyncExternalStore(subscribeActiveBuiltInSiteRules, getActiveBuiltInSiteRules)
}
