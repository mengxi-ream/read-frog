import type { NotebaseCreateInput, NotebaseGetSchemaOutput, NotebaseListOutput, NotebaseRowCreateInput } from "@read-frog/api-contract"
import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomActionNotebaseAccount } from "@/types/config/selection-toolbar"
import type { PendingConnectedNotebaseSave, PendingCreateNotebaseSave, PendingNotebaseSave, PendingNotebaseSaveActionStatus } from "@/utils/notebase/pending-save"
import { AUTH_COOKIE_PATTERNS } from "@read-frog/definitions"
import { browser } from "#imports"
import { env } from "@/env"
import { backgroundAuthClient } from "@/utils/auth/background-auth-client"
import { getLocalConfig, setLocalConfig } from "@/utils/config/storage"
import { logger } from "@/utils/logger"
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
import {
  buildNotebaseRowCells,
  validateNotebaseMappings,
} from "@/utils/notebase/mapping"
import {
  applyCreatedNotebaseConnectionToConfig,
  buildNotebaseCreateInputFromPending,
  clearPendingNotebaseSave,
  createPendingNotebaseSave,
  doesSchemaMatchPendingColumns,
  getNotebaseDetailUrl,
  getPendingNotebaseSave,
  isPendingNotebaseSaveExpired,
  validateStillCanSavePendingConnectedNotebaseSave,
  validateStillCanSavePendingCreateNotebaseSave,
} from "@/utils/notebase/pending-save"
import { backgroundOrpcClient } from "@/utils/orpc/background-client"

interface PendingNotebaseSaveProcessorDeps {
  getPendingNotebaseSave: () => Promise<PendingNotebaseSave | null>
  clearPendingNotebaseSave: () => Promise<void>
  getConfig: () => Promise<Config | null>
  setConfig: (config: Config) => Promise<void>
  getAuthenticatedAccount: () => Promise<SelectionToolbarCustomActionNotebaseAccount | null>
  createNotebase: (input: NotebaseCreateInput) => Promise<unknown>
  createRow: (input: NotebaseRowCreateInput) => Promise<unknown>
  listNotebases: () => Promise<NotebaseListOutput>
  getSchema: (id: string) => Promise<NotebaseGetSchemaOutput>
  openNotebasePage: (notebaseId: string) => Promise<void>
  openActionOptions: (actionId: string) => Promise<void>
  now: () => number
  log: Pick<typeof logger, "info" | "warn" | "error">
}

type PendingProcessingStatus = PendingNotebaseSaveActionStatus | "expired" | "missing_config"

function isAuthCookieChange(cookie: { domain?: string, name: string }) {
  if (!cookie.domain) {
    return false
  }

  const cookieDomain = cookie.domain
  return env.WXT_AUTH_COOKIE_DOMAINS.some((domain: string) => cookieDomain.includes(domain))
    && AUTH_COOKIE_PATTERNS.some(name => cookie.name.includes(name))
}

async function getAuthenticatedAccount() {
  try {
    const { data: session } = await backgroundAuthClient.getSession()
    if (!session?.user) {
      return null
    }

    return createNotebaseConnectedAccountSnapshot(
      session.user,
    ) ?? null
  }
  catch (error) {
    logger.warn("[NotebasePendingSave] Failed to probe auth session", error)
    return null
  }
}

function shouldClearCreateError(error: unknown) {
  return isORPCForbiddenError(error) || isORPCValidationError(error)
}

async function completePendingSave(
  deps: PendingNotebaseSaveProcessorDeps,
  pendingNotebaseSave: PendingCreateNotebaseSave,
  connectedAccount: SelectionToolbarCustomActionNotebaseAccount,
) {
  const config = await deps.getConfig()
  if (!config) {
    deps.log.warn("[NotebasePendingSave] Config unavailable after create; keeping pending save")
    return false
  }

  const applied = applyCreatedNotebaseConnectionToConfig(config, pendingNotebaseSave, { connectedAccount })
  if (applied.status !== "valid" || !applied.config) {
    await deps.clearPendingNotebaseSave()
    deps.log.info("[NotebasePendingSave] Cleared pending save before writing connection", {
      status: applied.status,
      pendingId: pendingNotebaseSave.id,
    })
    return false
  }

  await deps.setConfig(applied.config)
  await deps.clearPendingNotebaseSave()
  deps.log.info("[NotebasePendingSave] Pending save completed", {
    pendingId: pendingNotebaseSave.id,
    actionId: pendingNotebaseSave.actionId,
    notebaseId: pendingNotebaseSave.notebaseId,
  })

  try {
    await deps.openNotebasePage(pendingNotebaseSave.notebaseId)
  }
  catch (error) {
    deps.log.warn("[NotebasePendingSave] Failed to open Notebase detail page", error)
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
      deps.log.warn("[NotebasePendingSave] Duplicate recovery schema did not match pending columns", {
        pendingId: pendingNotebaseSave.id,
        notebaseId: pendingNotebaseSave.notebaseId,
      })
      return false
    }

    return await completePendingSave(deps, pendingNotebaseSave, connectedAccount)
  }
  catch (error) {
    deps.log.warn("[NotebasePendingSave] Duplicate recovery failed", error)
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

function getPendingSaveLogSubject(pendingNotebaseSave: PendingNotebaseSave) {
  return pendingNotebaseSave.kind === "save_to_connected_notebase"
    ? "connected pending save"
    : "pending save"
}

async function handlePendingLocalValidationFailure(
  deps: PendingNotebaseSaveProcessorDeps,
  pendingNotebaseSave: PendingNotebaseSave,
  pendingStatus: PendingProcessingStatus,
) {
  if (pendingStatus === "valid") {
    return false
  }

  const pendingSaveLogSubject = getPendingSaveLogSubject(pendingNotebaseSave)
  if (pendingStatus === "missing_config") {
    deps.log.warn(`[NotebasePendingSave] Config unavailable; keeping ${pendingSaveLogSubject}`, {
      pendingId: pendingNotebaseSave.id,
    })
    return true
  }

  await deps.clearPendingNotebaseSave()
  deps.log.info(`[NotebasePendingSave] Cleared invalid ${pendingSaveLogSubject}`, {
    pendingId: pendingNotebaseSave.id,
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
    deps.log.warn("[NotebasePendingSave] Config unavailable before replacement create; keeping pending save")
    return false
  }

  const validation = validateStillCanSavePendingConnectedNotebaseSave(config, pendingNotebaseSave)
  if (validation.status !== "valid" || !validation.action) {
    await deps.clearPendingNotebaseSave()
    deps.log.info("[NotebasePendingSave] Cleared connected pending save before replacement create", {
      pendingId: pendingNotebaseSave.id,
      status: validation.status,
    })
    return false
  }

  const replacementPendingNotebaseSave = createPendingNotebaseSave(validation.action, pendingNotebaseSave.result, deps.now())

  try {
    await deps.createNotebase(buildNotebaseCreateInputFromPending(replacementPendingNotebaseSave))
  }
  catch (error) {
    if (isORPCUnauthorizedError(error)) {
      deps.log.info("[NotebasePendingSave] Auth disappeared during replacement create; keeping pending save", {
        pendingId: pendingNotebaseSave.id,
      })
      return false
    }

    if (shouldClearCreateError(error)) {
      await deps.clearPendingNotebaseSave()
      deps.log.warn("[NotebasePendingSave] Cleared connected pending save after unrecoverable replacement create error", error)
      return false
    }

    deps.log.warn("[NotebasePendingSave] Replacement create failed; keeping pending save until expiry", error)
    return false
  }

  const latestConfig = await deps.getConfig()
  if (!latestConfig) {
    deps.log.warn("[NotebasePendingSave] Config unavailable after replacement create; keeping pending save")
    return false
  }

  const applied = applyCreatedNotebaseConnectionToConfig(latestConfig, replacementPendingNotebaseSave, {
    connectedAccount,
    replaceExistingConnection: true,
  })
  if (applied.status !== "valid" || !applied.config) {
    await deps.clearPendingNotebaseSave()
    deps.log.info("[NotebasePendingSave] Cleared connected pending save before writing replacement connection", {
      pendingId: pendingNotebaseSave.id,
      status: applied.status,
    })
    return false
  }

  await deps.setConfig(applied.config)
  await deps.clearPendingNotebaseSave()
  deps.log.info("[NotebasePendingSave] Connected pending save completed with replacement Notebase", {
    pendingId: pendingNotebaseSave.id,
    actionId: pendingNotebaseSave.actionId,
    notebaseId: replacementPendingNotebaseSave.notebaseId,
  })

  try {
    await deps.openNotebasePage(replacementPendingNotebaseSave.notebaseId)
  }
  catch (error) {
    deps.log.warn("[NotebasePendingSave] Failed to open replacement Notebase detail page", error)
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
    selectionToolbar: {
      ...config.selectionToolbar,
      customActions: config.selectionToolbar.customActions.map(action =>
        action.id === actionId
          ? { ...action, notebaseConnection: refreshedConnection }
          : action,
      ),
    },
  }
}

async function clearConnectedPendingAndOpenActionOptions(
  deps: PendingNotebaseSaveProcessorDeps,
  pendingNotebaseSave: PendingConnectedNotebaseSave,
  message: string,
  details?: unknown,
) {
  await deps.clearPendingNotebaseSave()
  deps.log.warn(message, details ?? {
    pendingId: pendingNotebaseSave.id,
    actionId: pendingNotebaseSave.actionId,
    notebaseId: pendingNotebaseSave.connectionSnapshot.notebaseId,
  })

  try {
    await deps.openActionOptions(pendingNotebaseSave.actionId)
  }
  catch (error) {
    deps.log.warn("[NotebasePendingSave] Failed to open action options", error)
  }
}

async function processCreatePendingSave(
  deps: PendingNotebaseSaveProcessorDeps,
  pendingNotebaseSave: PendingCreateNotebaseSave,
) {
  const pendingStatus = await getPendingLocalValidationStatus(deps, pendingNotebaseSave, validateStillCanSavePendingCreateNotebaseSave)
  if (await handlePendingLocalValidationFailure(deps, pendingNotebaseSave, pendingStatus)) {
    return
  }

  const connectedAccount = await deps.getAuthenticatedAccount()
  if (!connectedAccount) {
    deps.log.info("[NotebasePendingSave] User is not authenticated; keeping pending save", {
      pendingId: pendingNotebaseSave.id,
    })
    return
  }

  try {
    await deps.createNotebase(buildNotebaseCreateInputFromPending(pendingNotebaseSave))
    await completePendingSave(deps, pendingNotebaseSave, connectedAccount)
  }
  catch (error) {
    if (isORPCUnauthorizedError(error)) {
      deps.log.info("[NotebasePendingSave] Auth disappeared during create; keeping pending save", {
        pendingId: pendingNotebaseSave.id,
      })
      return
    }

    if (shouldClearCreateError(error)) {
      await deps.clearPendingNotebaseSave()
      deps.log.warn("[NotebasePendingSave] Cleared pending save after unrecoverable create error", error)
      return
    }

    if (await tryDuplicateCreateRecovery(deps, pendingNotebaseSave, connectedAccount)) {
      return
    }

    deps.log.warn("[NotebasePendingSave] Create failed; keeping pending save until expiry", error)
  }
}

async function processConnectedPendingSave(
  deps: PendingNotebaseSaveProcessorDeps,
  pendingNotebaseSave: PendingConnectedNotebaseSave,
) {
  const pendingStatus = await getPendingLocalValidationStatus(deps, pendingNotebaseSave, validateStillCanSavePendingConnectedNotebaseSave)
  if (await handlePendingLocalValidationFailure(deps, pendingNotebaseSave, pendingStatus)) {
    return
  }

  const connectedAccount = await deps.getAuthenticatedAccount()
  if (!connectedAccount) {
    deps.log.info("[NotebasePendingSave] User is not authenticated; keeping connected pending save", {
      pendingId: pendingNotebaseSave.id,
    })
    return
  }

  let notebases: NotebaseListOutput
  try {
    notebases = await deps.listNotebases()
  }
  catch (error) {
    if (isORPCUnauthorizedError(error)) {
      deps.log.info("[NotebasePendingSave] Auth disappeared while listing Notebases; keeping connected pending save", {
        pendingId: pendingNotebaseSave.id,
      })
      return
    }

    if (isORPCForbiddenError(error)) {
      await deps.clearPendingNotebaseSave()
      deps.log.warn("[NotebasePendingSave] Cleared connected pending save after Notebase list permission error", error)
      return
    }

    deps.log.warn("[NotebasePendingSave] Failed to list Notebases; keeping connected pending save", error)
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
  }
  catch (error) {
    if (isORPCUnauthorizedError(error)) {
      deps.log.info("[NotebasePendingSave] Auth disappeared while loading connected schema; keeping pending save", {
        pendingId: pendingNotebaseSave.id,
      })
      return
    }

    if (isORPCNotFoundError(error)) {
      await createReplacementNotebaseFromConnectedPending(deps, pendingNotebaseSave, connectedAccount)
      return
    }

    if (isORPCForbiddenError(error)) {
      await deps.clearPendingNotebaseSave()
      deps.log.warn("[NotebasePendingSave] Cleared connected pending save after connected schema permission error", error)
      return
    }

    deps.log.warn("[NotebasePendingSave] Failed to load connected schema; keeping pending save", error)
    return
  }

  const config = await deps.getConfig()
  if (!config) {
    deps.log.warn("[NotebasePendingSave] Config unavailable before connected row save; keeping pending save")
    return
  }

  const validation = validateStillCanSavePendingConnectedNotebaseSave(config, pendingNotebaseSave)
  if (validation.status !== "valid" || !validation.action) {
    await deps.clearPendingNotebaseSave()
    deps.log.info("[NotebasePendingSave] Cleared connected pending save before row save", {
      pendingId: pendingNotebaseSave.id,
      status: validation.status,
    })
    return
  }

  const refreshedConnection = refreshNotebaseConnectionAccountSnapshot(
    pendingNotebaseSave.connectionSnapshot,
    connectedAccount,
    schema.name,
  )
  const refreshedConfig = applyRefreshedConnectedConnectionToConfig(config, pendingNotebaseSave.actionId, refreshedConnection)
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
      "[NotebasePendingSave] Cleared connected pending save with invalid mappings",
    )
    return
  }

  const { cells } = buildNotebaseRowCells(actionWithRefreshedConnection, schema, pendingNotebaseSave.result)

  try {
    await deps.createRow({
      notebaseId: refreshedConnection.notebaseId,
      data: {
        cells,
      },
    })
  }
  catch (error) {
    if (isORPCUnauthorizedError(error)) {
      deps.log.info("[NotebasePendingSave] Auth disappeared during connected row save; keeping pending save", {
        pendingId: pendingNotebaseSave.id,
      })
      return
    }

    if (isORPCNotFoundError(error)) {
      await createReplacementNotebaseFromConnectedPending(deps, pendingNotebaseSave, connectedAccount)
      return
    }

    if (isORPCForbiddenError(error)) {
      await deps.clearPendingNotebaseSave()
      deps.log.warn("[NotebasePendingSave] Cleared connected pending save after row permission error", error)
      return
    }

    if (isORPCValidationError(error)) {
      await clearConnectedPendingAndOpenActionOptions(
        deps,
        pendingNotebaseSave,
        "[NotebasePendingSave] Cleared connected pending save after row validation error",
        error,
      )
      return
    }

    deps.log.warn("[NotebasePendingSave] Connected row save failed; keeping pending save until expiry", error)
    return
  }

  await deps.clearPendingNotebaseSave()
  deps.log.info("[NotebasePendingSave] Connected pending row save completed", {
    pendingId: pendingNotebaseSave.id,
    actionId: pendingNotebaseSave.actionId,
    notebaseId: refreshedConnection.notebaseId,
  })

  try {
    await deps.openNotebasePage(refreshedConnection.notebaseId)
  }
  catch (error) {
    deps.log.warn("[NotebasePendingSave] Failed to open connected Notebase detail page", error)
  }
}

export function createNotebasePendingSaveProcessor(deps: PendingNotebaseSaveProcessorDeps) {
  let isProcessing = false

  return async function processPendingNotebaseSave(reason: string) {
    if (isProcessing) {
      deps.log.info("[NotebasePendingSave] Skipping duplicate processor run", { reason })
      return
    }

    isProcessing = true
    try {
      const pendingNotebaseSave = await deps.getPendingNotebaseSave()
      if (!pendingNotebaseSave) {
        return
      }

      if (pendingNotebaseSave.kind === "save_to_connected_notebase") {
        await processConnectedPendingSave(deps, pendingNotebaseSave)
        return
      }

      await processCreatePendingSave(deps, pendingNotebaseSave)
    }
    catch (error) {
      deps.log.error("[NotebasePendingSave] Processor failed", error)
    }
    finally {
      isProcessing = false
    }
  }
}

export function setupNotebasePendingSaveProcessor() {
  const processPendingNotebaseSave = createNotebasePendingSaveProcessor({
    getPendingNotebaseSave,
    clearPendingNotebaseSave,
    getConfig: getLocalConfig,
    setConfig: setLocalConfig,
    getAuthenticatedAccount,
    createNotebase: input => backgroundOrpcClient.notebase.create(input),
    createRow: input => backgroundOrpcClient.notebaseRow.create(input),
    listNotebases: () => backgroundOrpcClient.notebase.list({}),
    getSchema: id => backgroundOrpcClient.notebase.getSchema({ id }),
    openNotebasePage: async (notebaseId) => {
      await browser.tabs.create({
        active: true,
        url: getNotebaseDetailUrl(notebaseId),
      })
    },
    openActionOptions: async (actionId) => {
      await browser.tabs.create({
        active: true,
        url: browser.runtime.getURL(`/options.html#/custom-actions?actionId=${encodeURIComponent(actionId)}`),
      })
    },
    now: () => Date.now(),
    log: logger,
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
