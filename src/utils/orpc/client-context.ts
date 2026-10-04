import type { Client } from "@orpc/client"
import type { ORPCRouterClient } from "@read-frog/api-contract"
import type { ClientContextHeaderInput } from "@read-frog/definitions"
import { CLIENT_CONTEXT_HEADER, formatClientContextHeader } from "@read-frog/definitions"
import { storage } from "#imports"
import {
  ANALYTICS_ENABLED_STORAGE_KEY,
  DEFAULT_ANALYTICS_ENABLED,
} from "@/utils/constants/analytics"

/** Per-call context the extension's oRPC clients accept. */
export interface ExtensionORPCClientContext {
  /** Where a Notebase write came from, reported to the server's save analytics. */
  noteSave?: ClientContextHeaderInput
}

type WithClientContext<T, TContext extends ExtensionORPCClientContext> =
  T extends Client<never, infer TInput, infer TOutput, infer TError>
    ? Client<TContext, TInput, TOutput, TError>
    : { [K in keyof T]: WithClientContext<T[K], TContext> }

export type ExtensionORPCClient = WithClientContext<ORPCRouterClient, ExtensionORPCClientContext>

async function isAnalyticsEnabled(): Promise<boolean> {
  try {
    const enabled = await storage.getItem<boolean>(`local:${ANALYTICS_ENABLED_STORAGE_KEY}`)
    return typeof enabled === "boolean" ? enabled : DEFAULT_ANALYTICS_ENABLED
  } catch {
    return false
  }
}

/**
 * Headers for one call. The save context is telemetry, so it is only sent
 * while the user keeps the extension's analytics switch on.
 */
export async function buildExtensionORPCHeaders(
  context: ExtensionORPCClientContext | undefined,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "x-orpc-source": "extension" }
  const clientContext = context?.noteSave && formatClientContextHeader(context.noteSave)
  if (clientContext && (await isAnalyticsEnabled())) {
    headers[CLIENT_CONTEXT_HEADER] = clientContext
  }

  return headers
}
