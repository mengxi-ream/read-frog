import type { StoredLogRecord } from "@/utils/logging/stored-record"
import { browser, storage } from "#imports"
import { EXTENSION_VERSION } from "@/utils/constants/app"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import { db } from "@/utils/db/dexie/db"
import { redactSecrets } from "@/utils/logging/sanitize"
import { readStoredLogRecords } from "@/utils/logging/sinks/persist"
import { getStoredRemoteSiteRules } from "@/utils/site-rules/remote/storage"

/** A section that could not be read says why, so the rest of the report still gets out. */
type Section<T> = T | { unavailable: string }

/**
 * What a user sends us with a bug report. Built in the background, which owns
 * the local log, and saved to a file by the page that asked for it; nothing in
 * it leaves the device unless the user sends the file.
 */
export interface DiagnosticsReport {
  format: 1
  generatedAt: string
  extensionVersion: string
  environment: Section<{
    userAgent: string
    os: string
    arch: string
    browserLanguage: string
  }>
  /** As stored, before validation, so a broken config shows up as it is. Secrets removed. */
  config: Section<{ schemaVersion: unknown; value: unknown }>
  remoteSiteRules: Section<{ revision: number; extensionVersion: string; fetchedAt: string } | null>
  /** Rows per local table, so an oversized or emptied cache shows up. */
  database: Section<Record<string, number>>
  logs: Section<StoredLogRecord[]>
}

async function section<T>(read: () => Promise<T>): Promise<Section<T>> {
  try {
    return await read()
  } catch (error) {
    return { unavailable: error instanceof Error ? error.message : String(error) }
  }
}

export async function buildDiagnosticsReport(): Promise<DiagnosticsReport> {
  const [environment, config, remoteSiteRules, database, logs] = await Promise.all([
    section(async () => {
      const { os, arch } = await browser.runtime.getPlatformInfo()
      return {
        userAgent: navigator.userAgent,
        os,
        arch,
        browserLanguage: browser.i18n.getUILanguage(),
      }
    }),
    section(async () => {
      const [value, meta] = await Promise.all([
        storage.getItem(`local:${CONFIG_STORAGE_KEY}`),
        storage.getMeta<{ schemaVersion?: unknown }>(`local:${CONFIG_STORAGE_KEY}`),
      ])
      return { schemaVersion: meta.schemaVersion ?? null, value: redactSecrets(value) }
    }),
    section(async () => {
      const stored = await getStoredRemoteSiteRules()
      return (
        stored && {
          revision: stored.revision,
          extensionVersion: stored.extensionVersion,
          fetchedAt: new Date(stored.fetchedAt).toISOString(),
        }
      )
    }),
    section(async () =>
      Object.fromEntries(
        await Promise.all(db.tables.map(async (table) => [table.name, await table.count()])),
      ),
    ),
    section(readStoredLogRecords),
  ])

  return {
    format: 1,
    generatedAt: new Date().toISOString(),
    extensionVersion: EXTENSION_VERSION,
    environment,
    config,
    remoteSiteRules,
    database,
    logs,
  }
}
