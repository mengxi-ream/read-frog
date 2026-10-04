import { z } from "zod"
import { getRandomUUID } from "@/utils/crypto-polyfill"

export const CUSTOM_ACTION_RESULT_SCHEMA_VERSION = 1

export const customActionResultRecordSchema = z.object({
  id: z.uuid(),
  schemaVersion: z.number().int().positive(),
  customActionId: z.string().min(1),
  customActionName: z.string().min(1),
  fields: z.record(z.string(), z.unknown()),
  sourceUrl: z.string().nullable(),
  sourceTitle: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export type CustomActionResultRecord = z.infer<typeof customActionResultRecordSchema>

export const customActionResultStorageProviderSchema = z.enum(["notebase", "local", "webdav"])
export type CustomActionResultStorageProvider = z.infer<
  typeof customActionResultStorageProviderSchema
>

export const webDavStorageSettingsSchema = z.object({
  serverUrl: z.string(),
  directory: z.string(),
  username: z.string(),
  password: z.string(),
})

export type WebDavStorageSettings = z.infer<typeof webDavStorageSettingsSchema>

export const customActionResultStorageSettingsSchema = z.object({
  provider: customActionResultStorageProviderSchema,
  webDav: webDavStorageSettingsSchema,
})

export type CustomActionResultStorageSettings = z.infer<
  typeof customActionResultStorageSettingsSchema
>

export const DEFAULT_CUSTOM_ACTION_RESULT_STORAGE_SETTINGS: CustomActionResultStorageSettings = {
  provider: "notebase",
  webDav: {
    serverUrl: "",
    directory: "Read Frog",
    username: "",
    password: "",
  },
}

export const customActionResultStorageErrorSchema = z.enum([
  "invalid_config",
  "https_required",
  "http_not_local",
  "invalid_credentials",
  "unauthorized",
  "forbidden",
  "not_found",
  "directory_missing",
  "server_error",
  "network_error",
  "invalid_response",
  "database_error",
  "unsupported_provider",
])

export type CustomActionResultStorageError = z.infer<typeof customActionResultStorageErrorSchema>

export type CustomActionResultStorageResponse<T> =
  | { ok: true; value: T }
  | { ok: false; error: CustomActionResultStorageError }

export interface SaveCustomActionResultsRequest {
  actionId: string
  actionName: string
  results: Array<Record<string, unknown>>
  sourceUrl: string | null
  sourceTitle: string | null
  now?: number
}

export function createCustomActionResultRecord(
  request: SaveCustomActionResultsRequest,
  fields: Record<string, unknown>,
  now = request.now ?? Date.now(),
): CustomActionResultRecord {
  return {
    id: getRandomUUID(),
    schemaVersion: CUSTOM_ACTION_RESULT_SCHEMA_VERSION,
    customActionId: request.actionId,
    customActionName: request.actionName,
    fields,
    sourceUrl: request.sourceUrl,
    sourceTitle: request.sourceTitle,
    createdAt: now,
    updatedAt: now,
  }
}
