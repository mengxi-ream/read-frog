import type { ContractRouterClient } from "@orpc/contract"
import type { contract } from "@read-frog/api-contract"
import type { ClientContextHeaderInput } from "@read-frog/definitions"
import { CLIENT_CONTEXT_HEADER, formatClientContextHeader } from "@read-frog/definitions"
import { storage } from "#imports"
import {
  ANALYTICS_ENABLED_STORAGE_KEY,
  DEFAULT_ANALYTICS_ENABLED,
} from "@/utils/constants/analytics"

/**
 * Per-call context the extension's oRPC links accept. Name each field after
 * what the link does with it, not after the feature passing it, so a new
 * caller reuses a field instead of adding one.
 */
export interface ExtensionORPCClientContext {
  /** Sent as the client-context header: telemetry only, left out while analytics is off. */
  analytics?: ClientContextHeaderInput
}

export type ExtensionORPCClient = ContractRouterClient<typeof contract, ExtensionORPCClientContext>

async function isAnalyticsEnabled(): Promise<boolean> {
  try {
    const enabled = await storage.getItem<boolean>(`local:${ANALYTICS_ENABLED_STORAGE_KEY}`)
    return typeof enabled === "boolean" ? enabled : DEFAULT_ANALYTICS_ENABLED
  } catch {
    return false
  }
}

/**
 * Headers for one call. The analytics context is telemetry, so it is only
 * sent while the user keeps the extension's analytics switch on.
 */
export async function buildExtensionORPCHeaders(
  context: ExtensionORPCClientContext | undefined,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "x-orpc-source": "extension" }
  const clientContext = context?.analytics && formatClientContextHeader(context.analytics)
  if (clientContext && (await isAnalyticsEnabled())) {
    headers[CLIENT_CONTEXT_HEADER] = clientContext
  }

  return headers
}
