import type {
  NotebaseGetSchemaOutput,
  NotebaseListOutput,
} from "@read-frog/api-contract"
import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionNotebaseConnection,
  SelectionToolbarCustomActionNotebaseMapping,
  SelectionToolbarCustomActionOutputField,
} from "@/types/config/selection-toolbar"
import { IconChevronsRight, IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react"
import { useStore } from "@tanstack/react-form"
import { useQuery } from "@tanstack/react-query"
import { dequal } from "dequal"
import { useEffect, useMemo } from "react"
import { i18n } from "#imports"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/base-ui/alert"
import { Button } from "@/components/ui/base-ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/base-ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { env } from "@/env"
import { authClient } from "@/utils/auth/auth-client"
import {
  createNotebaseMapping,
  isNotebaseMappingCompatible,
  isORPCNotFoundError,
  isSupportedNotebaseColumnConfig,
  resolveNotebaseMappings,
  sanitizeCustomActionNotebaseConnection,
} from "@/utils/notebase"
import { isORPCForbiddenError, useNotebaseBetaStatus } from "@/utils/notebase-beta"
import { orpc } from "@/utils/orpc/client"
import { withForm } from "./form"

type NotebaseI18nKey = Parameters<typeof i18n.t>[0]
type NotebaseItem = NotebaseListOutput[number]
type NotebaseColumn = NotebaseGetSchemaOutput["notebaseColumns"][number]

interface SelectItemData<T> {
  value: T
  label: string
}

function t(key: string) {
  return i18n.t(`options.floatingButtonAndToolbar.selectionToolbar.customActions.form.notebase.${key}` as NotebaseI18nKey)
}

function getMappingStatusMessage(status: ReturnType<typeof resolveNotebaseMappings>[number]["status"]) {
  switch (status) {
    case "missing_local":
      return t("mappingMissingLocal")
    case "missing_remote":
      return t("mappingMissingRemote")
    case "missing_schema":
      return t("mappingMissingSchema")
    case "incompatible":
      return t("mappingIncompatible")
    case "valid":
      return null
  }
}

function getSelectableLocalFields(
  outputSchema: SelectionToolbarCustomActionOutputField[],
  connection: SelectionToolbarCustomActionNotebaseConnection,
  currentMapping: SelectionToolbarCustomActionNotebaseMapping,
) {
  const usedLocalFieldIds = new Set(
    connection.mappings
      .filter(mapping => mapping.id !== currentMapping.id)
      .map(mapping => mapping.localFieldId),
  )

  return outputSchema.filter(field =>
    !usedLocalFieldIds.has(field.id) || field.id === currentMapping.localFieldId,
  )
}

function getSelectableRemoteColumns(
  connection: SelectionToolbarCustomActionNotebaseConnection,
  currentLocalField: SelectionToolbarCustomActionOutputField | null,
  currentMapping: SelectionToolbarCustomActionNotebaseMapping,
  notebaseColumns: NotebaseGetSchemaOutput["notebaseColumns"],
) {
  const usedRemoteColumnIds = new Set(
    connection.mappings
      .filter(mapping => mapping.id !== currentMapping.id)
      .map(mapping => mapping.notebaseColumnId),
  )

  return notebaseColumns.filter((column) => {
    if (!isSupportedNotebaseColumnConfig(column.config)) {
      return false
    }

    if (usedRemoteColumnIds.has(column.id) && column.id !== currentMapping.notebaseColumnId) {
      return false
    }

    if (!currentLocalField) {
      return column.id === currentMapping.notebaseColumnId
    }

    return column.id === currentMapping.notebaseColumnId
      || isNotebaseMappingCompatible(currentLocalField.type, column.config)
  })
}

function getNextDefaultMapping(
  connection: SelectionToolbarCustomActionNotebaseConnection,
  outputSchema: SelectionToolbarCustomActionOutputField[],
  notebaseColumns: NotebaseGetSchemaOutput["notebaseColumns"],
) {
  const usedLocalFieldIds = new Set(connection.mappings.map(mapping => mapping.localFieldId))
  const usedRemoteColumnIds = new Set(connection.mappings.map(mapping => mapping.notebaseColumnId))

  for (const localField of outputSchema) {
    if (usedLocalFieldIds.has(localField.id)) {
      continue
    }

    const notebaseColumn = notebaseColumns.find(column =>
      !usedRemoteColumnIds.has(column.id)
      && isSupportedNotebaseColumnConfig(column.config)
      && isNotebaseMappingCompatible(localField.type, column.config),
    )

    if (notebaseColumn) {
      return createNotebaseMapping(localField.id, notebaseColumn.id, notebaseColumn.name)
    }
  }

  return null
}

function getNotebaseSelectItems(
  connection: SelectionToolbarCustomActionNotebaseConnection | undefined,
  notebases: NotebaseListOutput | undefined,
) {
  if (!connection?.notebaseId) {
    return notebases ?? []
  }

  if (!notebases?.some(notebase => notebase.id === connection.notebaseId)) {
    return [
      {
        id: connection.notebaseId,
        name: `${connection.notebaseNameSnapshot} (${t("tableUnavailableOption")})`,
      },
      ...(notebases ?? []),
    ]
  }

  return notebases
}

function getLocalFieldSelectItems(fields: SelectionToolbarCustomActionOutputField[]): SelectItemData<string>[] {
  return fields.map(field => ({
    value: field.id,
    label: field.name,
  }))
}

function getRemoteFieldSelectItems(
  mapping: SelectionToolbarCustomActionNotebaseMapping,
  remoteOptions: NotebaseGetSchemaOutput["notebaseColumns"],
  currentRemoteMissing: boolean,
): SelectItemData<string>[] {
  return [
    ...(currentRemoteMissing
      ? [{
          value: mapping.notebaseColumnId,
          label: `${mapping.notebaseColumnNameSnapshot} (${t("columnUnavailableOption")})`,
        }]
      : []),
    ...remoteOptions.map(column => ({
      value: column.id,
      label: column.name,
    })),
  ]
}

export const NotebaseConnectionField = withForm({
  ...{ defaultValues: {} as SelectionToolbarCustomAction },
  render: function Render({ form }) {
    const action = useStore(form.store, state => state.values)
    const outputSchema = action.outputSchema
    const connection = action.notebaseConnection
    const { data: session, isPending: isSessionPending } = authClient.useSession()
    const isAuthenticated = !!session?.user
    const betaStatusQuery = useNotebaseBetaStatus(isAuthenticated)
    const isBetaAllowed = betaStatusQuery.data?.allowed === true
    const isBetaLocked = betaStatusQuery.data?.allowed === false

    const listQuery = useQuery(orpc.notebase.list.queryOptions({
      input: {},
      enabled: isAuthenticated && isBetaAllowed,
      staleTime: 60_000,
      meta: {
        suppressToast: true,
      },
    }))

    const schemaQuery = useQuery(orpc.notebase.getSchema.queryOptions({
      input: { id: connection?.notebaseId ?? "" },
      enabled: isAuthenticated && isBetaAllowed && !!connection?.notebaseId,
      retry: false,
      meta: {
        suppressToast: true,
      },
    }))

    const sanitizedConnection = useMemo(
      () => sanitizeCustomActionNotebaseConnection(connection, outputSchema),
      [connection, outputSchema],
    )

    useEffect(() => {
      if (!dequal(connection, sanitizedConnection)) {
        form.setFieldValue("notebaseConnection", sanitizedConnection)
        void form.handleSubmit()
      }
    }, [connection, form, sanitizedConnection])

    const resolvedMappings = useMemo(
      () => resolveNotebaseMappings({ ...action, notebaseConnection: sanitizedConnection }, schemaQuery.data),
      [action, sanitizedConnection, schemaQuery.data],
    )

    const hasInvalidMappings = resolvedMappings.some(mapping => mapping.status !== "valid")
    const selectableNotebaseItems = useMemo(
      () => getNotebaseSelectItems(sanitizedConnection, listQuery.data),
      [listQuery.data, sanitizedConnection],
    )
    const notebaseUnavailable = !!sanitizedConnection?.notebaseId
      && !schemaQuery.isPending
      && !schemaQuery.isFetching
      && !!schemaQuery.error
      && isORPCNotFoundError(schemaQuery.error)

    const updateConnection = (nextConnection: SelectionToolbarCustomActionNotebaseConnection | undefined) => {
      form.setFieldValue("notebaseConnection", nextConnection)
      void form.handleSubmit()
    }

    const handleNotebaseChange = (notebaseId: string | null) => {
      if (!notebaseId) {
        updateConnection(undefined)
        return
      }

      const notebase = listQuery.data?.find((item: NotebaseItem) => item.id === notebaseId)
      updateConnection({
        notebaseId,
        notebaseNameSnapshot: notebase?.name ?? sanitizedConnection?.notebaseNameSnapshot ?? notebaseId,
        mappings: [],
      })
    }

    const handleRefresh = async () => {
      const refreshResult = await schemaQuery.refetch()
      if (!refreshResult.data || !sanitizedConnection) {
        return
      }

      updateConnection({
        ...sanitizedConnection,
        notebaseNameSnapshot: refreshResult.data.name,
        mappings: sanitizedConnection.mappings.map(mapping => ({
          ...mapping,
          notebaseColumnNameSnapshot:
            refreshResult.data.notebaseColumns.find(
              (column: NotebaseColumn) => column.id === mapping.notebaseColumnId,
            )?.name ?? mapping.notebaseColumnNameSnapshot,
        })),
      })
    }

    const handleAddMapping = () => {
      if (!sanitizedConnection || !schemaQuery.data) {
        return
      }

      const nextMapping = getNextDefaultMapping(sanitizedConnection, outputSchema, schemaQuery.data.notebaseColumns)
      if (!nextMapping) {
        return
      }

      updateConnection({
        ...sanitizedConnection,
        mappings: [...sanitizedConnection.mappings, nextMapping],
      })
    }

    return (
      <Field className="rounded-xl border border-dashed bg-muted/10 p-4 gap-4">
        <div className="space-y-1">
          <FieldLabel nativeLabel={false} render={<div />}>
            {t("title")}
          </FieldLabel>
          <p className="text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>

        {!isAuthenticated && !isSessionPending && (
          <Alert>
            <AlertTitle>{t("loginRequiredTitle")}</AlertTitle>
            <AlertDescription>
              {t("loginRequiredDescription")}
              {sanitizedConnection ? ` ${sanitizedConnection.notebaseNameSnapshot}` : ""}
            </AlertDescription>
            <AlertAction>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => window.open(`${env.WXT_WEBSITE_URL}/log-in`, "_blank")}
              >
                {t("loginAction")}
              </Button>
            </AlertAction>
          </Alert>
        )}

        {isAuthenticated && (
          <FieldGroup className="gap-4">
            {!!betaStatusQuery.error && (
              <Alert variant="destructive">
                <AlertTitle>{t("schemaErrorTitle")}</AlertTitle>
                <AlertDescription>{t("schemaErrorDescription")}</AlertDescription>
              </Alert>
            )}

            {isBetaLocked && (
              <Alert>
                <AlertTitle>{t("betaLockedTitle")}</AlertTitle>
                <AlertDescription>{t("betaLockedDescription")}</AlertDescription>
                <AlertAction>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`${env.WXT_WEBSITE_URL}/notebase`, "_blank")}
                  >
                    {t("openNotebaseAction")}
                  </Button>
                </AlertAction>
              </Alert>
            )}

            <Field>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel nativeLabel={false} render={<div />}>
                  {t("tableLabel")}
                </FieldLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={!isBetaAllowed || !sanitizedConnection?.notebaseId || schemaQuery.isFetching}
                >
                  <IconRefresh className={schemaQuery.isFetching ? "animate-spin" : undefined} />
                  {t("refreshAction")}
                </Button>
              </div>

              <Select<string | null>
                value={sanitizedConnection?.notebaseId ?? null}
                items={[
                  {
                    value: null,
                    label: t("tableClearOption"),
                  },
                  ...(selectableNotebaseItems?.map(notebase => ({
                    value: notebase.id,
                    label: notebase.name,
                  })) ?? []),
                ]}
                onValueChange={handleNotebaseChange}
                disabled={!isBetaAllowed}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("tablePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={null}>
                      {t("tableClearOption")}
                    </SelectItem>
                    {selectableNotebaseItems?.map(notebase => (
                      <SelectItem key={notebase.id} value={notebase.id}>
                        {notebase.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            {isBetaAllowed && !listQuery.isPending && !listQuery.error && listQuery.data?.length === 0 && (
              <Alert>
                <AlertTitle>{t("emptyTitle")}</AlertTitle>
                <AlertDescription>{t("emptyDescription")}</AlertDescription>
                <AlertAction>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`${env.WXT_WEBSITE_URL}/notebase`, "_blank")}
                  >
                    {t("openNotebaseAction")}
                  </Button>
                </AlertAction>
              </Alert>
            )}

            {!!listQuery.error && !isORPCForbiddenError(listQuery.error) && (
              <Alert variant="destructive">
                <AlertTitle>{t("schemaErrorTitle")}</AlertTitle>
                <AlertDescription>{t("schemaErrorDescription")}</AlertDescription>
              </Alert>
            )}

            {notebaseUnavailable && (
              <Alert variant="destructive">
                <AlertTitle>{t("tableUnavailableTitle")}</AlertTitle>
                <AlertDescription>{t("tableUnavailableDescription")}</AlertDescription>
              </Alert>
            )}

            {!!sanitizedConnection?.notebaseId && !!schemaQuery.error && !notebaseUnavailable && (
              <Alert variant="destructive">
                <AlertTitle>{t("schemaErrorTitle")}</AlertTitle>
                <AlertDescription>{t("schemaErrorDescription")}</AlertDescription>
              </Alert>
            )}

            {!!sanitizedConnection?.notebaseId && schemaQuery.isPending && (
              <p className="text-sm text-muted-foreground">{t("schemaLoading")}</p>
            )}

            {!!sanitizedConnection?.notebaseId && schemaQuery.data && (
              <>
                {hasInvalidMappings && (
                  <Alert variant="destructive">
                    <AlertTitle>{t("invalidMappingsTitle")}</AlertTitle>
                    <AlertDescription>{t("invalidMappingsDescription")}</AlertDescription>
                  </Alert>
                )}

                <Field className="gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel nativeLabel={false} render={<div />}>
                      {t("mappingsLabel")}
                    </FieldLabel>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAddMapping}
                      disabled={!getNextDefaultMapping(sanitizedConnection, outputSchema, schemaQuery.data.notebaseColumns)}
                    >
                      <IconPlus className="size-4" />
                      {t("addMappingAction")}
                    </Button>
                  </div>

                  {sanitizedConnection.mappings.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t("mappingsEmpty")}</p>
                  )}

                  <div className="space-y-2">
                    <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] md:items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
                      <span>{t("localFieldLabel")}</span>
                      <span />
                      <span>{t("remoteFieldLabel")}</span>
                      <span />
                    </div>

                    {resolvedMappings.map(({ localField, mapping, notebaseColumn, status }) => {
                      const localOptions = getSelectableLocalFields(outputSchema, sanitizedConnection, mapping)
                      const remoteOptions = getSelectableRemoteColumns(
                        sanitizedConnection,
                        localField,
                        mapping,
                        schemaQuery.data.notebaseColumns,
                      )
                      const currentRemoteMissing = !schemaQuery.data.notebaseColumns.some(
                        (column: NotebaseColumn) => column.id === mapping.notebaseColumnId,
                      )
                      const localSelectItems = getLocalFieldSelectItems(localOptions)
                      const remoteSelectItems = getRemoteFieldSelectItems(mapping, remoteOptions, currentRemoteMissing)

                      return (
                        <div key={mapping.id} className="space-y-1.5">
                          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] md:items-center">
                            <Select<string>
                              value={mapping.localFieldId}
                              items={localSelectItems}
                              onValueChange={(value) => {
                                if (typeof value !== "string") {
                                  return
                                }

                                updateConnection({
                                  ...sanitizedConnection,
                                  mappings: sanitizedConnection.mappings.map(item =>
                                    item.id === mapping.id
                                      ? { ...item, localFieldId: value }
                                      : item,
                                  ),
                                })
                              }}
                            >
                              <SelectTrigger className="w-full" aria-invalid={status !== "valid"}>
                                <SelectValue placeholder={t("localFieldPlaceholder")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {localOptions.map(field => (
                                    <SelectItem key={field.id} value={field.id}>
                                      {field.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>

                            <div className="hidden md:flex items-center justify-center text-muted-foreground">
                              <IconChevronsRight className="size-4" />
                            </div>

                            <Select<string>
                              value={mapping.notebaseColumnId}
                              items={remoteSelectItems}
                              onValueChange={(value) => {
                                if (typeof value !== "string") {
                                  return
                                }

                                const nextNotebaseColumn = schemaQuery.data.notebaseColumns.find(
                                  (column: NotebaseColumn) => column.id === value,
                                )
                                updateConnection({
                                  ...sanitizedConnection,
                                  mappings: sanitizedConnection.mappings.map(item =>
                                    item.id === mapping.id
                                      ? {
                                          ...item,
                                          notebaseColumnId: value,
                                          notebaseColumnNameSnapshot: nextNotebaseColumn?.name ?? item.notebaseColumnNameSnapshot,
                                        }
                                      : item,
                                  ),
                                })
                              }}
                            >
                              <SelectTrigger className="w-full" aria-invalid={status !== "valid"}>
                                <SelectValue placeholder={t("remoteFieldPlaceholder")}>
                                  {notebaseColumn?.name
                                    ?? (currentRemoteMissing
                                      ? `${mapping.notebaseColumnNameSnapshot} (${t("columnUnavailableOption")})`
                                      : mapping.notebaseColumnNameSnapshot)}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {currentRemoteMissing && (
                                    <SelectItem key={`${mapping.id}-missing`} value={mapping.notebaseColumnId}>
                                      {`${mapping.notebaseColumnNameSnapshot} (${t("columnUnavailableOption")})`}
                                    </SelectItem>
                                  )}
                                  {remoteOptions.map(column => (
                                    <SelectItem key={column.id} value={column.id}>
                                      {column.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>

                            <div className="flex justify-end md:justify-start">
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => {
                                  updateConnection({
                                    ...sanitizedConnection,
                                    mappings: sanitizedConnection.mappings.filter(item => item.id !== mapping.id),
                                  })
                                }}
                                aria-label={t("removeMappingAction")}
                                title={t("removeMappingAction")}
                              >
                                <IconTrash />
                              </Button>
                            </div>
                          </div>

                          {status !== "valid" && (
                            <p className="px-1 text-xs text-destructive">
                              {getMappingStatusMessage(status)}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </Field>
              </>
            )}
          </FieldGroup>
        )}
      </Field>
    )
  },
})
