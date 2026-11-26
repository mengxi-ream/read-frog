import type {
  NotebaseCreateInput,
  NotebaseGetSchemaOutput,
  NotebaseListOutput,
  NotebaseRowCreateInput,
  NotebaseRowCreateManyInput,
} from "@read-frog/api-contract"
import type { AnalyticsFailureReason } from "@/types/analytics"
import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomActionNotebaseAccount } from "@/types/config/selection-toolbar"
import type { GuideDictionaryNotebaseCompletionInput } from "@/utils/guide/dictionary-notebase"
import type { NoteSaveCompletion } from "@/utils/note-save/analytics"
import type {
  PendingConnectedNotebaseSave,
  PendingCreateNotebaseSave,
  PendingNotebaseSave,
  PendingNotebaseSaveActionStatus,
} from "@/utils/notebase/pending-save"
import { AUTH_COOKIE_PATTERNS } from "@read-frog/definitions"
import { browser } from "#imports"
import { env } from "@/env"
import { buildFeatureUsedEventProperties } from "@/utils/analytics"
import { classifyFailureReason } from "@/utils/analytics-failure-reason"
import { backgroundAuthClient } from "@/utils/auth/background-auth-client"
import { getLocalConfig, setLocalConfig } from "@/utils/config/storage"
import { patchSelectionToolbarAction } from "@/utils/custom-actions"
import { createLogger } from "@/utils/logging/logger"
import { buildCustomActionOptionsRoute } from "@/utils/navigation"
import { createNoteSaveCompletedEvent } from "@/utils/note-save/analytics"
import {
  classifyConnectedNotebaseOwnership,
  createNotebaseConnectedAccountSnapshot,
  isConnectedNotebaseInList,
  refreshNotebaseConnectionAccountSnapshot,
} from "@/utils/notebase/connection"
import {
  isORPCForbiddenError,
  isORPCNotFoundError,
  isORPCUnauthorizedError,
  isORPCValidationError,
} from "@/utils/notebase/errors"
import { buildNotebaseRowCells, validateNotebaseMappings } from "@/utils/notebase/mapping"
import {
  applyCreatedNotebaseConnectionToConfig,
  buildNotebaseCreateInputFromPending,
  clearPendingNotebaseSave,
  createPendingNotebaseSave,
  doesSchemaMatchPendingColumns,
  getNotebaseDetailUrl,
  getPendingNotebaseSave,
  getPendingNotebaseSaveContext,
  getPendingNoteSaveAnalyticsSurface,
  isPendingNotebaseSaveExpired,
  validateStillCanSavePendingConnectedNotebaseSave,
  validateStillCanSavePendingCreateNotebaseSave,
} from "@/utils/notebase/pending-save"
import { backgroundOrpcClient } from "@/utils/orpc/background-client"
import { captureFeatureUsedEventInBackground } from "./analytics"
import { completeGuideDictionaryNotebaseAndNotify } from "./new-user-guide"

const log = createLogger("background/notebase-pending-save")

interface PendingNotebaseSaveProcessorDeps {
  waitUntilReady: () => Promise<void>
  getPendingNotebaseSave: () => Promise<PendingNotebaseSave | null>
  clearPendingNotebaseSave: () => Promise<void>
  getConfig: () => Promise<Config | null>
  setConfig: (config: Config) => Promise<void>
  getAuthenticatedAccount: () => Promise<SelectionToolbarCustomActionNotebaseAccount | null>
  createNotebase: (input: NotebaseCreateInput, noteSave: NoteSaveContext) => Promise<unknown>
  createRow: (input: NotebaseRowCreateInput, noteSave: NoteSaveContext) => Promise<unknown>
  createRows: (input: NotebaseRowCreateManyInput, noteSave: NoteSaveContext) => Promise<unknown>
  listNotebases: () => Promise<NotebaseListOutput>
  getSchema: (id: string) => Promise<NotebaseGetSchemaOutput>
  openNotebasePage: (notebaseId: string) => Promise<void>
  openActionOptions: (actionId: string) => Promise<void>
  completeGuideDictionaryNotebase: (input: GuideDictionaryNotebaseCompletionInput) => Promise<void>
  reportNoteSave: (completion: NoteSaveCompletion) => void
  now: () => number
}

type PendingProcessingStatus = PendingNotebaseSaveActionStatus | "expired" | "missing_config"
type NoteSaveContext = ReturnType<typeof getPendingNotebaseSaveContext>

/**
 * A pending save's final outcome, once it either reached the server or was
 * dropped for an error retrying cannot fix. Saves kept for a retry report
 * nothing yet, and an expired one never reports: that gap is the abandon rate.
 */
function reportPendingSaveOutcome(
  deps: PendingNotebaseSaveProcessorDeps,
  pendingNotebaseSave: PendingNotebaseSave,
  error?: unknown,
) {
  const context = getPendingNotebaseSaveContext(pendingNotebaseSave)
  deps.reportNoteSave({
    surface: getPendingNoteSaveAnalyticsSurface(pendingNotebaseSave),
    saveSource: context.surface,
    isGuide: context.isGuide,
    noteCount:
      pendingNotebaseSave.kind === "create_notebase"
        ? pendingNotebaseSave.rows.length
        : pendingNotebaseSave.results.length,
    path: "after_login",
    startedAt: pendingNotebaseSave.createdAt,
    ...(error === undefined ? {} : { failureReason: classifyFailureReason(error) }),
  })
}

function isAuthCookieChange(cookie: { domain?: string; name: string }) {
  if (!cookie.domain) {
    return false
  }

  const cookieDomain = cookie.domain
  return (
    env.WXT_AUTH_COOKIE_DOMAINS.some((domain: string) => cookieDomain.includes(domain)) &&
    AUTH_COOKIE_PATTERNS.some((name) => cookie.name.includes(name))
  )
}

async function getAuthenticatedAccount() {
  try {
    const { data: session } = await backgroundAuthClient.getSession()
    if (!session?.user) {
      return null
    }

    return createNotebaseConnectedAccountSnapshot(session.user) ?? null
  } catch (error) {
    log.warn("Failed to probe auth session", { error })
    return null
  }
}

function shouldClearCreateError(error: unknown) {
  return isORPCForbiddenError(error) || isORPCValidationError(error)
}

async function completeGuideDictionaryNotebaseIfNeeded(
  deps: PendingNotebaseSaveProcessorDeps,
  pendingNotebaseSave: PendingNotebaseSave,
  notebaseId: string,
) {
  const tracking = pendingNotebaseSave.guideDictionaryNotebaseTracking
  if (!tracking || tracking.actionId !== pendingNotebaseSave.actionId) {
    return
  }

  try {
    await deps.completeGuideDictionaryNotebase({
      trackingId: tracking.id,
      actionId: tracking.actionId,
      notebaseId,
      sourceUrl: tracking.sourceUrl,
    })
  } catch (error) {
    log.warn("Failed to complete guide Dictionary Notebase flow", { error })
  }
}

async function completePendingSave(
  deps: PendingNotebaseSaveProcessorDeps,
  pendingNotebaseSave: PendingCreateNotebaseSave,
  connectedAccount: SelectionToolbarCustomActionNotebaseAccount,
) {
  const config = await deps.getConfig()
  if (!config) {
    log.warn("Config unavailable after create; keeping pending save")
    return false
  }

  const applied = applyCreatedNotebaseConnectionToConfig(config, pendingNotebaseSave, {
    connectedAccount,
  })
  if (applied.status !== "valid" || !applied.config) {
    await deps.clearPendingNotebaseSave()
    // The Notebase and its notes exist; only connecting the action failed.
    reportPendingSaveOutcome(deps, pendingNotebaseSave)
    log.info("Cleared pending save before writing connection", {
      status: applied.status,
      pendingId: pendingNotebaseSave.id,
    })
    return false
  }

  await deps.setConfig(applied.config)
  await deps.clearPendingNotebaseSave()
  reportPendingSaveOutcome(deps, pendingNotebaseSave)
  await completeGuideDictionaryNotebaseIfNeeded(
    deps,
    pendingNotebaseSave,
    pendingNotebaseSave.notebaseId,
  )
  log.info("Pending save completed", {
    pendingId: pendingNotebaseSave.id,
    actionId: pendingNotebaseSave.actionId,
    notebaseId: pendingNotebaseSave.notebaseId,
  })

  try {
    await deps.openNotebasePage(pendingNotebaseSave.notebaseId)
  } catch (error) {
    log.warn("Failed to open Notebase detail page", { error })
  }

  return true
}

async function tryDuplicateCreateRecovery(
  deps: PendingNotebaseSaveProcessorDeps,
  pendingNotebaseSave: PendingCreateNotebaseSave,
  connectedAccount: SelectionToolbarCustomActionNotebaseAccount,
) {
  try {
    const schema = await deps.getSchema(pendingNotebaseSave.notebaseId)
    if (!doesSchemaMatchPendingColumns(schema, pendingNotebaseSave)) {
      log.warn("Duplicate recovery schema did not match pending columns", {
        pendingId: pendingNotebaseSave.id,
        notebaseId: pendingNotebaseSave.notebaseId,
      })
      return false
    }

    return await completePendingSave(deps, pendingNotebaseSave, connectedAccount)
  } catch (error) {
    log.warn("Duplicate recovery failed", { error })
    return false
  }
}

async function getPendingLocalValidationStatus<TPending extends PendingNotebaseSave>(
  deps: PendingNotebaseSaveProcessorDeps,
  pendingNotebaseSave: TPending,
  validate: (config: Config, pending: TPending) => { status: PendingNotebaseSaveActionStatus },
): Promise<PendingProcessingStatus> {
  if (isPendingNotebaseSaveExpired(pendingNotebaseSave, deps.now())) {
    return "expired"
  }

  const config = await deps.getConfig()
  if (!config) {
    return "missing_config"
  }

  return validate(config, pendingNotebaseSave).status
}

async function handlePendingLocalValidationFailure(
  deps: PendingNotebaseSaveProcessorDeps,
  pendingNotebaseSave: PendingNotebaseSave,
  pendingStatus: PendingProcessingStatus,
) {
  if (pendingStatus === "valid") {
    return false
  }

  if (pendingStatus === "missing_config") {
    log.warn("Config unavailable; keeping the pending save", {
      pendingId: pendingNotebaseSave.id,
      kind: pendingNotebaseSave.kind,
    })
    return true
  }

  await deps.clearPendingNotebaseSave()
  log.info("Cleared an invalid pending save", {
    pendingId: pendingNotebaseSave.id,
    kind: pendingNotebaseSave.kind,
    status: pendingStatus,
  })
  return true
}

async function createReplacementNotebaseFromConnectedPending(
  deps: PendingNotebaseSaveProcessorDeps,
  pendingNotebaseSave: PendingConnectedNotebaseSave,
  connectedAccount: SelectionToolbarCustomActionNotebaseAccount,
) {
  const config = await deps.getConfig()
  if (!config) {
    log.warn("Config unavailable before replacement create; keeping pending save")
    return false
  }

  const validation = validateStillCanSavePendingConnectedNotebaseSave(config, pendingNotebaseSave)
  if (validation.status !== "valid" || !validation.action) {
    await deps.clearPendingNotebaseSave()
    log.info("Cleared connected pending save before replacement create", {
      pendingId: pendingNotebaseSave.id,
      status: validation.status,
    })
    return false
  }

  const replacementPendingNotebaseSave = createPendingNotebaseSave(
    validation.action,
    pendingNotebaseSave.results,
    deps.now(),
    {
      guideDictionaryNotebaseTracking: pendingNotebaseSave.guideDictionaryNotebaseTracking,
      ...(pendingNotebaseSave.saveSource ? { saveSource: pendingNotebaseSave.saveSource } : {}),
      analyticsSurface: pendingNotebaseSave.analyticsSurface,
      ...(pendingNotebaseSave.origin ? { origin: pendingNotebaseSave.origin } : {}),
    },
  )

  try {
    await deps.createNotebase(
      buildNotebaseCreateInputFromPending(replacementPendingNotebaseSave),
      getPendingNotebaseSaveContext(pendingNotebaseSave),
    )
  } catch (error) {
    if (isORPCUnauthorizedError(error)) {
      log.info("Auth disappeared during replacement create; keeping pending save", {
        pendingId: pendingNotebaseSave.id,
      })
      return false
    }

    if (shouldClearCreateError(error)) {
      await deps.clearPendingNotebaseSave()
      reportPendingSaveOutcome(deps, pendingNotebaseSave, error)
      log.warn("Cleared connected pending save after unrecoverable replacement create error", {
        error,
      })
      return false
    }

    log.warn("Replacement create failed; keeping pending save until expiry", { error })
    return false
  }

  const latestConfig = await deps.getConfig()
  if (!latestConfig) {
    log.warn("Config unavailable after replacement create; keeping pending save")
    return false
  }

  const applied = applyCreatedNotebaseConnectionToConfig(
    latestConfig,
    replacementPendingNotebaseSave,
    {
      connectedAccount,
      replaceExistingConnection: true,
    },
  )
  if (applied.status !== "valid" || !applied.config) {
    await deps.clearPendingNotebaseSave()
    // The replacement Notebase and its notes exist; only connecting the action failed.
    reportPendingSaveOutcome(deps, pendingNotebaseSave)
    log.info("Cleared connected pending save before writing replacement connection", {
      pendingId: pendingNotebaseSave.id,
      status: applied.status,
    })
    return false
  }

  await deps.setConfig(applied.config)
  await deps.clearPendingNotebaseSave()
  reportPendingSaveOutcome(deps, pendingNotebaseSave)
  await completeGuideDictionaryNotebaseIfNeeded(
    deps,
    replacementPendingNotebaseSave,
    replacementPendingNotebaseSave.notebaseId,
  )
  log.info("Connected pending save completed with replacement Notebase", {
    pendingId: pendingNotebaseSave.id,
    actionId: pendingNotebaseSave.actionId,
    notebaseId: replacementPendingNotebaseSave.notebaseId,
  })

  try {
    await deps.openNotebasePage(replacementPendingNotebaseSave.notebaseId)
  } catch (error) {
    log.warn("Failed to open replacement Notebase detail page", { error })
  }

  return true
}

function applyRefreshedConnectedConnectionToConfig(
  config: Config,
  actionId: string,
  refreshedConnection: PendingConnectedNotebaseSave["connectionSnapshot"],
) {
  return {
    ...config,
    selectionToolbar: patchSelectionToolbarAction(config.selectionToolbar, actionId, {
      notebaseConnection: refreshedConnection,
    }),
  }
}

async function clearConnectedPendingAndOpenActionOptions(
  deps: PendingNotebaseSaveProcessorDeps,
  pendingNotebaseSave: PendingConnectedNotebaseSave,
  message: string,
) {
  await deps.clearPendingNotebaseSave()
  log.warn(message, {
    pendingId: pendingNotebaseSave.id,
    actionId: pendingNotebaseSave.actionId,
    notebaseId: pendingNotebaseSave.connectionSnapshot.notebaseId,
  })

  try {
    await deps.openActionOptions(pendingNotebaseSave.actionId)
  } catch (error) {
    log.warn("Failed to open action options", { error })
  }
}

async function processCreatePendingSave(
  deps: PendingNotebaseSaveProcessorDeps,
  pendingNotebaseSave: PendingCreateNotebaseSave,
) {
  const pendingStatus = await getPendingLocalValidationStatus(
    deps,
    pendingNotebaseSave,
    validateStillCanSavePendingCreateNotebaseSave,
  )
  if (await handlePendingLocalValidationFailure(deps, pendingNotebaseSave, pendingStatus)) {
    return
  }

  const connectedAccount = await deps.getAuthenticatedAccount()
  if (!connectedAccount) {
    log.info("User is not authenticated; keeping pending save", {
      pendingId: pendingNotebaseSave.id,
    })
    return
  }

  try {
    await deps.createNotebase(
      buildNotebaseCreateInputFromPending(pendingNotebaseSave),
      getPendingNotebaseSaveContext(pendingNotebaseSave),
    )
    await completePendingSave(deps, pendingNotebaseSave, connectedAccount)
  } catch (error) {
    if (isORPCUnauthorizedError(error)) {
      log.info("Auth disappeared during create; keeping pending save", {
        pendingId: pendingNotebaseSave.id,
      })
      return
    }

    if (shouldClearCreateError(error)) {
      await deps.clearPendingNotebaseSave()
      reportPendingSaveOutcome(deps, pendingNotebaseSave, error)
      log.warn("Cleared pending save after unrecoverable create error", { error })
      return
    }

    if (await tryDuplicateCreateRecovery(deps, pendingNotebaseSave, connectedAccount)) {
      return
    }

    log.warn("Create failed; keeping pending save until expiry", { error })
  }
}

async function processConnectedPendingSave(
  deps: PendingNotebaseSaveProcessorDeps,
  pendingNotebaseSave: PendingConnectedNotebaseSave,
) {
  const pendingStatus = await getPendingLocalValidationStatus(
    deps,
    pendingNotebaseSave,
    validateStillCanSavePendingConnectedNotebaseSave,
  )
  if (await handlePendingLocalValidationFailure(deps, pendingNotebaseSave, pendingStatus)) {
    return
  }

  const connectedAccount = await deps.getAuthenticatedAccount()
  if (!connectedAccount) {
    log.info("User is not authenticated; keeping connected pending save", {
      pendingId: pendingNotebaseSave.id,
    })
    return
  }

  let notebases: NotebaseListOutput
  try {
    notebases = await deps.listNotebases()
  } catch (error) {
    if (isORPCUnauthorizedError(error)) {
      log.info("Auth disappeared while listing Notebases; keeping connected pending save", {
        pendingId: pendingNotebaseSave.id,
      })
      return
    }

    if (isORPCForbiddenError(error)) {
      await deps.clearPendingNotebaseSave()
      reportPendingSaveOutcome(deps, pendingNotebaseSave, error)
      log.warn("Cleared connected pending save after Notebase list permission error", { error })
      return
    }

    log.warn("Failed to list Notebases; keeping connected pending save", { error })
    return
  }

  const ownership = classifyConnectedNotebaseOwnership({
    connection: pendingNotebaseSave.connectionSnapshot,
    currentAccount: connectedAccount,
    isOwned: isConnectedNotebaseInList(pendingNotebaseSave.connectionSnapshot, notebases),
  })

  if (ownership.kind !== "owned") {
    await createReplacementNotebaseFromConnectedPending(deps, pendingNotebaseSave, connectedAccount)
    return
  }

  let schema: NotebaseGetSchemaOutput
  try {
    schema = await deps.getSchema(pendingNotebaseSave.connectionSnapshot.notebaseId)
  } catch (error) {
    if (isORPCUnauthorizedError(error)) {
      log.info("Auth disappeared while loading connected schema; keeping pending save", {
        pendingId: pendingNotebaseSave.id,
      })
      return
    }

    if (isORPCNotFoundError(error)) {
      await createReplacementNotebaseFromConnectedPending(
        deps,
        pendingNotebaseSave,
        connectedAccount,
      )
      return
    }

    if (isORPCForbiddenError(error)) {
      await deps.clearPendingNotebaseSave()
      reportPendingSaveOutcome(deps, pendingNotebaseSave, error)
      log.warn("Cleared connected pending save after connected schema permission error", { error })
      return
    }

    log.warn("Failed to load connected schema; keeping pending save", { error })
    return
  }

  const config = await deps.getConfig()
  if (!config) {
    log.warn("Config unavailable before connected row save; keeping pending save")
    return
  }

  const validation = validateStillCanSavePendingConnectedNotebaseSave(config, pendingNotebaseSave)
  if (validation.status !== "valid" || !validation.action) {
    await deps.clearPendingNotebaseSave()
    log.info("Cleared connected pending save before row save", {
      pendingId: pendingNotebaseSave.id,
      status: validation.status,
    })
    return
  }

  // The current connection, not the snapshot: validation checked that its
  // Notebase and mappings still match, and fields the reader set to "don't
  // save" since the click must not be written back as undecided.
  const refreshedConnection = refreshNotebaseConnectionAccountSnapshot(
    validation.action.notebaseConnection ?? pendingNotebaseSave.connectionSnapshot,
    connectedAccount,
    schema.name,
  )
  const refreshedConfig = applyRefreshedConnectedConnectionToConfig(
    config,
    pendingNotebaseSave.actionId,
    refreshedConnection,
  )
  await deps.setConfig(refreshedConfig)

  const actionWithRefreshedConnection = {
    ...validation.action,
    notebaseConnection: refreshedConnection,
  }
  const mappingValidation = validateNotebaseMappings(actionWithRefreshedConnection, schema)
  if (mappingValidation.kind !== "valid") {
    await clearConnectedPendingAndOpenActionOptions(
      deps,
      pendingNotebaseSave,
      "Cleared connected pending save with invalid mappings",
    )
    // Dropped like the server's validation error below, which retrying cannot fix either.
    reportPendingSaveOutcome(deps, pendingNotebaseSave, {
      reason: "validation" satisfies AnalyticsFailureReason,
    })
    return
  }

  const cellsList = pendingNotebaseSave.results.map(
    (result) => buildNotebaseRowCells(actionWithRefreshedConnection, schema, result).cells,
  )

  const noteSave = getPendingNotebaseSaveContext(pendingNotebaseSave)
  const originField = pendingNotebaseSave.origin ? { origin: pendingNotebaseSave.origin } : {}
  try {
    const [firstCells] = cellsList
    if (cellsList.length === 1 && firstCells) {
      await deps.createRow(
        {
          notebaseId: refreshedConnection.notebaseId,
          data: {
            cells: firstCells,
            ...originField,
          },
        },
        noteSave,
      )
    } else {
      await deps.createRows(
        {
          notebaseId: refreshedConnection.notebaseId,
          rows: cellsList.map((cells) => ({ cells, ...originField })),
        },
        noteSave,
      )
    }
  } catch (error) {
    if (isORPCUnauthorizedError(error)) {
      log.info("Auth disappeared during connected row save; keeping pending save", {
        pendingId: pendingNotebaseSave.id,
      })
      return
    }

    if (isORPCNotFoundError(error)) {
      await createReplacementNotebaseFromConnectedPending(
        deps,
        pendingNotebaseSave,
        connectedAccount,
      )
      return
    }

    if (isORPCForbiddenError(error)) {
      await deps.clearPendingNotebaseSave()
      reportPendingSaveOutcome(deps, pendingNotebaseSave, error)
      log.warn("Cleared connected pending save after row permission error", { error })
      return
    }

    // The mappings were checked against a fresh schema just before the write,
    // so a rejected cell is a value in the answer. Opening the mappings would
    // send the reader to change a connection that works.
    if (isORPCValidationError(error)) {
      await deps.clearPendingNotebaseSave()
      reportPendingSaveOutcome(deps, pendingNotebaseSave, error)
      log.warn("Cleared connected pending save after the server rejected a cell", { error })
      return
    }

    log.warn("Connected row save failed; keeping pending save until expiry", { error })
    return
  }

  await deps.clearPendingNotebaseSave()
  reportPendingSaveOutcome(deps, pendingNotebaseSave)
  await completeGuideDictionaryNotebaseIfNeeded(
    deps,
    pendingNotebaseSave,
    refreshedConnection.notebaseId,
  )
  log.info("Connected pending row save completed", {
    pendingId: pendingNotebaseSave.id,
    actionId: pendingNotebaseSave.actionId,
    notebaseId: refreshedConnection.notebaseId,
  })

  try {
    await deps.openNotebasePage(refreshedConnection.notebaseId)
  } catch (error) {
    log.warn("Failed to open connected Notebase detail page", { error })
  }
}

export function createNotebasePendingSaveProcessor(deps: PendingNotebaseSaveProcessorDeps) {
  let isProcessing = false

  return async function processPendingNotebaseSave(reason: string) {
    if (isProcessing) {
      log.info("Skipping duplicate processor run", { reason })
      return
    }

    isProcessing = true
    try {
      await deps.waitUntilReady()

      const pendingNotebaseSave = await deps.getPendingNotebaseSave()
      if (!pendingNotebaseSave) {
        return
      }

      if (pendingNotebaseSave.kind === "save_to_connected_notebase") {
        await processConnectedPendingSave(deps, pendingNotebaseSave)
        return
      }

      await processCreatePendingSave(deps, pendingNotebaseSave)
    } catch (error) {
      log.error("Processor failed", { error })
    } finally {
      isProcessing = false
    }
  }
}

export function setupNotebasePendingSaveProcessor(waitUntilReady: () => Promise<void>) {
  const processPendingNotebaseSave = createNotebasePendingSaveProcessor({
    waitUntilReady,
    getPendingNotebaseSave,
    clearPendingNotebaseSave,
    getConfig: getLocalConfig,
    setConfig: setLocalConfig,
    getAuthenticatedAccount,
    createNotebase: (input, noteSave) =>
      backgroundOrpcClient.notebase.create(input, { context: { analytics: noteSave } }),
    createRow: (input, noteSave) =>
      backgroundOrpcClient.notebaseRow.create(input, { context: { analytics: noteSave } }),
    createRows: (input, noteSave) =>
      backgroundOrpcClient.notebaseRow.createMany(input, { context: { analytics: noteSave } }),
    listNotebases: () => backgroundOrpcClient.notebase.list({}),
    getSchema: (id) => backgroundOrpcClient.notebase.getSchema({ id }),
    completeGuideDictionaryNotebase: completeGuideDictionaryNotebaseAndNotify,
    reportNoteSave: (completion) => {
      void captureFeatureUsedEventInBackground(
        buildFeatureUsedEventProperties(createNoteSaveCompletedEvent(completion)),
      ).catch((error) => {
        log.warn("Failed to report the save outcome", { error })
      })
    },
    openNotebasePage: async (notebaseId) => {
      await browser.tabs.create({
        active: true,
        url: getNotebaseDetailUrl(notebaseId),
      })
    },
    openActionOptions: async (actionId) => {
      await browser.tabs.create({
        active: true,
        url: browser.runtime.getURL(
          buildCustomActionOptionsRoute(actionId, { tab: "notebase", full: true }),
        ),
      })
    },
    now: () => Date.now(),
  })

  void processPendingNotebaseSave("startup")

  if (browser.cookies?.onChanged) {
    browser.cookies.onChanged.addListener((changeInfo) => {
      if (isAuthCookieChange(changeInfo.cookie)) {
        void processPendingNotebaseSave("auth-cookie-change")
      }
    })
  }
}
