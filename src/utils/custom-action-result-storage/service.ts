import type { CustomActionResultLocalProvider } from "./indexeddb"
import type {
  CustomActionResultRecord,
  CustomActionResultStorageError,
  CustomActionResultStorageResponse,
  SaveCustomActionResultsRequest,
} from "./types"
import type { WebDavStorageSettings } from "./types"
import { customActionResultLocalProvider } from "./indexeddb"
import { getCustomActionResultStorageSettings } from "./settings"
import { createCustomActionResultRecord } from "./types"
import { CustomActionResultStorageProviderError, CustomActionResultWebDavProvider } from "./webdav"

interface StorageServiceDependencies {
  getSettings: typeof getCustomActionResultStorageSettings
  localProvider: Pick<CustomActionResultLocalProvider, "save" | "list" | "delete">
  createWebDavProvider: (
    settings: WebDavStorageSettings,
  ) => Pick<CustomActionResultWebDavProvider, "save" | "list" | "delete" | "testConnection">
}

const defaultDependencies: StorageServiceDependencies = {
  getSettings: getCustomActionResultStorageSettings,
  localProvider: customActionResultLocalProvider,
  createWebDavProvider: (settings) => new CustomActionResultWebDavProvider(settings),
}

function getSafeErrorCode(error: unknown): CustomActionResultStorageError {
  if (error instanceof CustomActionResultStorageProviderError) return error.code
  if (error instanceof Error && error.message === "database_error") return "database_error"
  return "server_error"
}

async function runSafely<T>(
  operation: () => Promise<T>,
): Promise<CustomActionResultStorageResponse<T>> {
  try {
    return { ok: true, value: await operation() }
  } catch (error) {
    return { ok: false, error: getSafeErrorCode(error) }
  }
}

export async function saveCustomActionResults(
  request: SaveCustomActionResultsRequest,
  dependencies: StorageServiceDependencies = defaultDependencies,
): Promise<CustomActionResultStorageResponse<number>> {
  return runSafely(async () => {
    if (request.results.length === 0) return 0
    const settings = await dependencies.getSettings()
    const records = request.results.map((fields) => createCustomActionResultRecord(request, fields))

    if (settings.provider === "local") {
      await dependencies.localProvider.save(records)
    } else if (settings.provider === "webdav") {
      await dependencies.createWebDavProvider(settings.webDav).save(records)
    } else {
      throw new CustomActionResultStorageProviderError("unsupported_provider")
    }

    return records.length
  })
}

export async function listCustomActionResults(
  dependencies: StorageServiceDependencies = defaultDependencies,
): Promise<CustomActionResultStorageResponse<CustomActionResultRecord[]>> {
  return runSafely(async () => {
    const settings = await dependencies.getSettings()
    if (settings.provider === "local") return dependencies.localProvider.list()
    if (settings.provider === "webdav") {
      return dependencies.createWebDavProvider(settings.webDav).list()
    }
    return []
  })
}

export async function deleteCustomActionResult(
  id: string,
  dependencies: StorageServiceDependencies = defaultDependencies,
): Promise<CustomActionResultStorageResponse<void>> {
  return runSafely(async () => {
    const settings = await dependencies.getSettings()
    if (settings.provider === "local") return dependencies.localProvider.delete(id)
    if (settings.provider === "webdav") {
      return dependencies.createWebDavProvider(settings.webDav).delete(id)
    }
    throw new CustomActionResultStorageProviderError("unsupported_provider")
  })
}

export async function testWebDavCustomActionResultStorage(
  dependencies: StorageServiceDependencies = defaultDependencies,
): Promise<CustomActionResultStorageResponse<void>> {
  return runSafely(async () => {
    const settings = await dependencies.getSettings()
    if (settings.provider !== "webdav") {
      throw new CustomActionResultStorageProviderError("unsupported_provider")
    }
    return dependencies.createWebDavProvider(settings.webDav).testConnection()
  })
}
