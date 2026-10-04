import type { CustomActionResultStorageError } from "./types"
import type { I18nKey } from "@/utils/i18n"
import { i18n } from "@/utils/i18n"

const STORAGE_ERROR_I18N_KEYS = {
  invalid_config: "action.customActionResultStorageErrorInvalidConfig",
  https_required: "action.customActionResultStorageErrorHttpsRequired",
  http_not_local: "action.customActionResultStorageErrorHttpNotLocal",
  invalid_credentials: "action.customActionResultStorageErrorInvalidCredentials",
  unauthorized: "action.customActionResultStorageErrorUnauthorized",
  forbidden: "action.customActionResultStorageErrorForbidden",
  not_found: "action.customActionResultStorageErrorNotFound",
  directory_missing: "action.customActionResultStorageErrorDirectoryMissing",
  server_error: "action.customActionResultStorageErrorServer",
  network_error: "action.customActionResultStorageErrorNetwork",
  invalid_response: "action.customActionResultStorageErrorResponse",
  database_error: "action.customActionResultStorageErrorDatabase",
  unsupported_provider: "action.customActionResultStorageErrorProvider",
} as const satisfies Record<CustomActionResultStorageError, I18nKey>

export function getCustomActionResultStorageErrorMessage(error: CustomActionResultStorageError) {
  return i18n.t(STORAGE_ERROR_I18N_KEYS[error])
}
