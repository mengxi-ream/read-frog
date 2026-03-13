import { i18n } from "#imports"
import { extractAISDKErrorMessage } from "@/utils/error/extract-message"

export interface SelectionToolbarInlineError {
  title: string
  description: string
}

type SelectionToolbarErrorKind = "translate" | "customAction"
type SelectionToolbarPrecheckErrorCode = "actionUnavailable" | "missingSelection" | "providerDisabled" | "providerUnavailable"

const UNEXPECTED_ERROR_MESSAGE = "Unexpected error occurred"

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

function getErrorTitle(kind: SelectionToolbarErrorKind) {
  return kind === "translate"
    ? i18n.t("translationHub.translationFailed")
    : i18n.t("options.floatingButtonAndToolbar.selectionToolbar.errors.customActionFailed")
}

function getErrorFallbackDescription(kind: SelectionToolbarErrorKind) {
  return kind === "translate"
    ? i18n.t("translationHub.translationFailedFallback")
    : i18n.t("options.floatingButtonAndToolbar.selectionToolbar.errors.customActionFailedFallback")
}

function getPrecheckErrorDescription(code: SelectionToolbarPrecheckErrorCode) {
  return i18n.t(`options.floatingButtonAndToolbar.selectionToolbar.errors.${code}` as never)
}

function toErrorDescription(kind: SelectionToolbarErrorKind, error: unknown) {
  const message = extractAISDKErrorMessage(error)
  if (!message || message === UNEXPECTED_ERROR_MESSAGE) {
    return getErrorFallbackDescription(kind)
  }

  return message
}

export function createSelectionToolbarPrecheckError(
  kind: SelectionToolbarErrorKind,
  code: SelectionToolbarPrecheckErrorCode,
): SelectionToolbarInlineError {
  return {
    title: getErrorTitle(kind),
    description: getPrecheckErrorDescription(code),
  }
}

export function createSelectionToolbarRuntimeError(
  kind: SelectionToolbarErrorKind,
  error: unknown,
): SelectionToolbarInlineError {
  return {
    title: getErrorTitle(kind),
    description: toErrorDescription(kind, error),
  }
}
