import type { NotebaseGetSchemaOutput, NotebaseListOutput } from "@read-frog/api-contract"
import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionNotebaseAccount,
  SelectionToolbarCustomActionNotebaseConnection,
  SelectionToolbarCustomActionOutputField,
} from "@/types/config/selection-toolbar"
import { IconChevronsRight, IconExternalLink, IconRefresh } from "@tabler/icons-react"
import { useQuery } from "@tanstack/react-query"
import { useSelector } from "@tanstack/react-store"
import { dequal } from "dequal"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { useAutosaveContext } from "@/components/form/use-autosave"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/base-ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/base-ui/avatar"
import { Button, buttonVariants } from "@/components/ui/base-ui/button"
import { Field, FieldGroup, FieldTitle } from "@/components/ui/base-ui/field"
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
import { i18n } from "@/utils/i18n"
import {
  classifyConnectedNotebaseOwnership,
  createNotebaseConnectedAccountSnapshot,
  formatNotebaseConnectedAccountLabel,
  isConnectedNotebaseInList,
  refreshNotebaseConnectionAccountSnapshot,
  sanitizeCustomActionNotebaseConnection,
} from "@/utils/notebase/connection"
import { isORPCForbiddenError } from "@/utils/notebase/errors"
import {
  createNameMatchedNotebaseMappings,
  getUndecidedOutputFields,
  isNotebaseMappingCompatible,
  mapNotebaseField,
  resolveNotebaseMappings,
  skipNotebaseFields,
  validateNotebaseMappings,
} from "@/utils/notebase/mapping"
import { orpc } from "@/utils/orpc/client"
import { cn } from "@/utils/styles/utils"
import { withForm } from "./form"

type NotebaseItem = NotebaseListOutput[number]
type NotebaseColumn = NotebaseGetSchemaOutput["notebaseColumns"][number]

interface SelectItemData<T> {
  value: T
  label: string
}

function t(key: string, substitutions?: string[]) {
  const translate = i18n.t as (key: string, substitutions?: string[]) => string
  return translate(`options.selectionToolbar.customActions.form.notebase.${key}`, substitutions)
}

function getAccountFallback(
  account: SelectionToolbarCustomActionNotebaseAccount | undefined,
  fallbackLabel: string,
) {
  const label = formatNotebaseConnectedAccountLabel(account) ?? fallbackLabel
  return Array.from(label).slice(0, 2).join("").toUpperCase()
}

function ConnectedAccountDisplay({
  account,
  label,
}: {
  account: SelectionToolbarCustomActionNotebaseAccount | undefined
  label: string
}) {
  const accountLabel = formatNotebaseConnectedAccountLabel(account) ?? label

  return (
    <span className="inline-flex min-w-0 items-center gap-2 align-middle">
      <Avatar size="sm">
        <AvatarImage src={account?.image ?? ""} alt={accountLabel} />
        <AvatarFallback>{getAccountFallback(account, label)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate">{accountLabel}</span>
    </span>
  )
}

function getMappingStatusMessage(
  status: ReturnType<typeof resolveNotebaseMappings>[number]["status"],
) {
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
    default:
      return null
  }
}

// The "don't save" choice in a field's column select. Column ids are UUIDs,
// so it never collides with one.
const SKIP_FIELD_VALUE = "read-frog:skip-field"

// The columns a field can be saved to: those that hold its type and that no
// other field is saved to.
function getSelectableColumns(
  connection: SelectionToolbarCustomActionNotebaseConnection,
  field: SelectionToolbarCustomActionOutputField,
  notebaseColumns: NotebaseGetSchemaOutput["notebaseColumns"],
) {
  const usedByOtherFields = new Set(
    connection.mappings
      .filter((mapping) => mapping.localFieldId !== field.id)
      .map((mapping) => mapping.notebaseColumnId),
  )

  return notebaseColumns.filter(
    (column) =>
      isNotebaseMappingCompatible(field.type, column.config) && !usedByOtherFields.has(column.id),
  )
}

function getNotebaseSelectItems(notebases: NotebaseListOutput | undefined) {
  return notebases
}

export const NotebaseConnectionField = withForm({
  ...{ defaultValues: {} as SelectionToolbarCustomAction },
  props: {
    /** "tab" drops the dashed card and the title, for when a tab already frames and names it. */
    variant: "card" as "card" | "tab" | undefined,
  },
  render: function Render({ form, variant = "card" }) {
    const autosave = useAutosaveContext()
    // Only outputSchema and notebaseConnection are read from `action`. The field stays mounted in a
    // hidden tab, so re-render when those change, not on every keystroke elsewhere in the form.
    const action = useSelector(form.store, (state) => state.values, {
      compare: (a, b) =>
        a.outputSchema === b.outputSchema && a.notebaseConnection === b.notebaseConnection,
    })
    const outputSchema = action.outputSchema
    const connection = action.notebaseConnection
    const { data: session, isPending: isSessionPending } = authClient.useSession()
    const isAuthenticated = !!session?.user
    const currentAccount = createNotebaseConnectedAccountSnapshot(session?.user)
    const canWriteConnection = isAuthenticated && !!currentAccount
    const sanitizedConnection = useMemo(
      () => sanitizeCustomActionNotebaseConnection(connection, outputSchema),
      [connection, outputSchema],
    )

    const updateConnection = useCallback(
      (nextConnection: SelectionToolbarCustomActionNotebaseConnection | undefined) => {
        autosave.edit(() => form.setFieldValue("notebaseConnection", nextConnection), {
          immediate: true,
        })
      },
      [form, autosave],
    )

    const listQuery = useQuery(
      orpc.notebase.list.queryOptions({
        input: {},
        enabled: canWriteConnection,
        staleTime: 60_000,
        meta: {
          suppressToast: true,
        },
      }),
    )

    const ownedNotebase = sanitizedConnection
      ? listQuery.data?.find((item: NotebaseItem) => item.id === sanitizedConnection.notebaseId)
      : undefined
    const connectionOwnership =
      sanitizedConnection && currentAccount && listQuery.data
        ? classifyConnectedNotebaseOwnership({
            connection: sanitizedConnection,
            currentAccount,
            isOwned: isConnectedNotebaseInList(sanitizedConnection, listQuery.data),
          })
        : null
    const isOwnedConnection = connectionOwnership?.kind === "owned"
    const isNotebaseUnavailableConnection = connectionOwnership?.kind === "notebase_unavailable"
    const isForeignConnection = connectionOwnership?.kind === "foreign_account"

    const schemaQuery = useQuery(
      orpc.notebase.getSchema.queryOptions({
        input: { id: sanitizedConnection?.notebaseId ?? "" },
        enabled: canWriteConnection && !!sanitizedConnection?.notebaseId && isOwnedConnection,
        retry: false,
        meta: {
          suppressToast: true,
        },
      }),
    )

    // The Notebase just picked in the select. Once its columns load, the fields
    // that share a column's name are mapped to it, unless the reader has added
    // a mapping meanwhile.
    const autoMapNotebaseIdRef = useRef<string | null>(null)
    useEffect(() => {
      const schema = schemaQuery.data
      if (
        !schema ||
        !sanitizedConnection ||
        autoMapNotebaseIdRef.current !== schema.id ||
        sanitizedConnection.notebaseId !== schema.id
      ) {
        return
      }

      autoMapNotebaseIdRef.current = null
      if (sanitizedConnection.mappings.length > 0) {
        return
      }

      const mappings = createNameMatchedNotebaseMappings(outputSchema, schema.notebaseColumns)
      if (mappings.length > 0) {
        updateConnection({ ...sanitizedConnection, mappings })
      }
    }, [outputSchema, sanitizedConnection, schemaQuery.data, updateConnection])

    useEffect(() => {
      if (!isOwnedConnection || !sanitizedConnection || !currentAccount) {
        return
      }

      const refreshedConnection = refreshNotebaseConnectionAccountSnapshot(
        sanitizedConnection,
        currentAccount,
        ownedNotebase?.name,
      )
      if (!dequal(sanitizedConnection, refreshedConnection)) {
        updateConnection(refreshedConnection)
      }
    }, [
      currentAccount,
      isOwnedConnection,
      ownedNotebase?.name,
      sanitizedConnection,
      updateConnection,
    ])

    const mappingValidation = useMemo(
      () =>
        schemaQuery.data
          ? validateNotebaseMappings(
              { ...action, notebaseConnection: sanitizedConnection },
              schemaQuery.data,
            )
          : null,
      [action, sanitizedConnection, schemaQuery.data],
    )
    const resolvedMappings = useMemo(
      () =>
        mappingValidation?.resolvedMappings ??
        resolveNotebaseMappings(
          { ...action, notebaseConnection: sanitizedConnection },
          schemaQuery.data,
        ),
      [action, mappingValidation?.resolvedMappings, sanitizedConnection, schemaQuery.data],
    )

    const hasInvalidMappings = mappingValidation?.kind === "invalid"
    const undecidedFieldIds = useMemo(
      () =>
        new Set(
          sanitizedConnection
            ? getUndecidedOutputFields({ ...action, notebaseConnection: sanitizedConnection }).map(
                (field) => field.id,
              )
            : [],
        ),
      [action, sanitizedConnection],
    )
    const selectableNotebaseItems = useMemo(
      () => getNotebaseSelectItems(listQuery.data),
      [listQuery.data],
    )
    const notebaseUnavailable = !!sanitizedConnection && isNotebaseUnavailableConnection
    const notebaseAccountUnavailable = !!sanitizedConnection && isForeignConnection

    const handleClearConnection = () => {
      updateConnection(undefined)
    }

    const handleNotebaseChange = (notebaseId: string | null) => {
      if (!notebaseId) {
        handleClearConnection()
        return
      }

      if (!currentAccount) {
        return
      }

      // Select reports every pick, not only a change, so picking the connected
      // Notebase again must not touch its mappings: readers did that to
      // "refresh" a connection and lost all but the one they then re-added.
      if (isOwnedConnection && sanitizedConnection?.notebaseId === notebaseId) {
        return
      }

      const notebase = listQuery.data?.find((item: NotebaseItem) => item.id === notebaseId)
      autoMapNotebaseIdRef.current = notebaseId
      updateConnection({
        notebaseId,
        notebaseNameSnapshot:
          notebase?.name ?? sanitizedConnection?.notebaseNameSnapshot ?? notebaseId,
        connectedAccount: currentAccount,
        mappings: [],
      })
    }

    const handleRefresh = async () => {
      if (!currentAccount || !isOwnedConnection) {
        return
      }

      const refreshResult = await schemaQuery.refetch()
      if (!refreshResult.data || !sanitizedConnection) {
        return
      }

      updateConnection({
        ...sanitizedConnection,
        notebaseNameSnapshot: refreshResult.data.name,
        connectedAccount: currentAccount,
        mappings: sanitizedConnection.mappings.map((mapping) => ({
          ...mapping,
          notebaseColumnNameSnapshot:
            refreshResult.data.notebaseColumns.find(
              (column: NotebaseColumn) => column.id === mapping.notebaseColumnId,
            )?.name ?? mapping.notebaseColumnNameSnapshot,
        })),
      })
    }

    return (
      <Field
        className={
          variant === "tab" ? "gap-4" : "gap-4 rounded-xl border border-dashed bg-muted/10 p-4"
        }
      >
        {variant === "tab" ? (
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        ) : (
          <div className="space-y-1">
            <FieldTitle>{t("title")}</FieldTitle>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
        )}

        {!isAuthenticated && !isSessionPending && (
          <Alert>
            <AlertTitle>{t("loginRequiredTitle")}</AlertTitle>
            <AlertDescription>
              {sanitizedConnection ? (
                <div className="flex flex-col gap-2">
                  <span>{t("loginRequiredConnectedDescription")}</span>
                  <ConnectedAccountDisplay
                    account={sanitizedConnection.connectedAccount}
                    label={t("unknownConnectedAccount")}
                  />
                </div>
              ) : (
                t("loginRequiredDescription")
              )}
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
            <Field>
              <div className="flex items-center justify-between gap-3">
                <FieldTitle>{t("tableLabel")}</FieldTitle>
                <div className="flex items-center gap-2">
                  {isOwnedConnection && !!sanitizedConnection?.notebaseId && (
                    <a
                      href={new URL(
                        `/notebase/${encodeURIComponent(sanitizedConnection.notebaseId)}`,
                        env.WXT_WEBSITE_URL,
                      ).toString()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      <IconExternalLink />
                      {t("openNotebaseAction")}
                    </a>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={
                      !currentAccount ||
                      !sanitizedConnection?.notebaseId ||
                      !isOwnedConnection ||
                      schemaQuery.isFetching
                    }
                  >
                    <IconRefresh className={schemaQuery.isFetching ? "animate-spin" : undefined} />
                    {t("refreshAction")}
                  </Button>
                </div>
              </div>

              <Select<string | null>
                value={isOwnedConnection ? (sanitizedConnection?.notebaseId ?? null) : null}
                items={[
                  {
                    value: null,
                    label: t("tableClearOption"),
                  },
                  ...(selectableNotebaseItems?.map((notebase) => ({
                    value: notebase.id,
                    label: notebase.name,
                  })) ?? []),
                ]}
                onValueChange={handleNotebaseChange}
                disabled={!currentAccount}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("tablePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={null}>{t("tableClearOption")}</SelectItem>
                    {selectableNotebaseItems?.map((notebase) => (
                      <SelectItem key={notebase.id} value={notebase.id}>
                        {notebase.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            {notebaseAccountUnavailable && (
              <Alert variant="destructive">
                <AlertTitle>{t("accountMismatchTitle")}</AlertTitle>
                <AlertDescription>
                  <div className="flex flex-col gap-2">
                    <span>{t("accountMismatchDescription")}</span>
                    <div className="grid gap-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {t("connectedAccountLabel")}
                      </span>
                      <ConnectedAccountDisplay
                        account={sanitizedConnection?.connectedAccount}
                        label={t("unknownConnectedAccount")}
                      />
                    </div>
                    <div className="grid gap-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {t("currentAccountLabel")}
                      </span>
                      <ConnectedAccountDisplay
                        account={currentAccount}
                        label={t("unknownConnectedAccount")}
                      />
                    </div>
                  </div>
                </AlertDescription>
                <AlertAction>
                  <Button type="button" size="sm" variant="outline" onClick={handleClearConnection}>
                    {t("clearConnectionAction")}
                  </Button>
                </AlertAction>
              </Alert>
            )}

            {!listQuery.isPending && !listQuery.error && listQuery.data?.length === 0 && (
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

            {!!listQuery.error && (
              <Alert variant="destructive">
                <AlertTitle>
                  {isORPCForbiddenError(listQuery.error)
                    ? t("accessDeniedTitle")
                    : t("listErrorTitle")}
                </AlertTitle>
                <AlertDescription>
                  {isORPCForbiddenError(listQuery.error)
                    ? t("accessDeniedDescription")
                    : t("listErrorDescription")}
                </AlertDescription>
              </Alert>
            )}

            {notebaseUnavailable && (
              <Alert variant="destructive">
                <AlertTitle>{t("tableUnavailableTitle")}</AlertTitle>
                <AlertDescription>{t("tableUnavailableDescription")}</AlertDescription>
                <AlertAction>
                  <Button type="button" size="sm" variant="outline" onClick={handleClearConnection}>
                    {t("clearConnectionAction")}
                  </Button>
                </AlertAction>
              </Alert>
            )}

            {isOwnedConnection &&
              !!sanitizedConnection?.notebaseId &&
              !!schemaQuery.error &&
              !notebaseUnavailable &&
              !notebaseAccountUnavailable && (
                <Alert variant="destructive">
                  <AlertTitle>{t("schemaErrorTitle")}</AlertTitle>
                  <AlertDescription>{t("schemaErrorDescription")}</AlertDescription>
                </Alert>
              )}

            {isOwnedConnection && !!sanitizedConnection?.notebaseId && schemaQuery.isPending && (
              <p className="text-sm text-muted-foreground">
                <span className="shimmer">{t("schemaLoading")}</span>
              </p>
            )}

            {isOwnedConnection && !!sanitizedConnection?.notebaseId && schemaQuery.data && (
              <>
                {hasInvalidMappings && (
                  <Alert variant="destructive">
                    <AlertTitle>{t("invalidMappingsTitle")}</AlertTitle>
                    <AlertDescription>{t("invalidMappingsDescription")}</AlertDescription>
                  </Alert>
                )}

                {mappingValidation?.kind === "empty" && (
                  <Alert variant="warning">
                    <AlertTitle>{t("noFieldSavedTitle")}</AlertTitle>
                    <AlertDescription>{t("noFieldSavedDescription")}</AlertDescription>
                  </Alert>
                )}

                <Field className="gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <FieldTitle>{t("mappingsLabel")}</FieldTitle>
                    <span className="text-xs text-muted-foreground">
                      {t("mappingSummary", [
                        String(sanitizedConnection.mappings.length),
                        String(sanitizedConnection.skippedFieldIds?.length ?? 0),
                        String(undecidedFieldIds.size),
                      ])}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                      <span>{t("localFieldLabel")}</span>
                      <span />
                      <span>{t("remoteFieldLabel")}</span>
                    </div>

                    {outputSchema.map((field) => {
                      const resolved = resolvedMappings.find(
                        ({ mapping }) => mapping.localFieldId === field.id,
                      )
                      const mapping = resolved?.mapping
                      const isSkipped = sanitizedConnection.skippedFieldIds?.includes(field.id)
                      const isUndecided = undecidedFieldIds.has(field.id)
                      const columns = getSelectableColumns(
                        sanitizedConnection,
                        field,
                        schemaQuery.data.notebaseColumns,
                      )
                      const currentColumnMissing =
                        !!mapping &&
                        !schemaQuery.data.notebaseColumns.some(
                          (column: NotebaseColumn) => column.id === mapping.notebaseColumnId,
                        )
                      const missingColumnLabel = mapping
                        ? `${mapping.notebaseColumnNameSnapshot} (${t("columnUnavailableOption")})`
                        : ""
                      const items: SelectItemData<string>[] = [
                        { value: SKIP_FIELD_VALUE, label: t("skipFieldOption") },
                        ...(currentColumnMissing
                          ? [{ value: mapping.notebaseColumnId, label: missingColumnLabel }]
                          : []),
                        ...columns.map((column) => ({ value: column.id, label: column.name })),
                      ]

                      return (
                        <div key={field.id} className="space-y-1.5">
                          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                            <span
                              className={cn(
                                "truncate px-1 text-sm",
                                isSkipped && "text-muted-foreground",
                              )}
                            >
                              {field.name}
                            </span>

                            <div className="hidden items-center justify-center text-muted-foreground md:flex">
                              <IconChevronsRight className="size-4" />
                            </div>

                            <Select<string | null>
                              value={
                                mapping?.notebaseColumnId ?? (isSkipped ? SKIP_FIELD_VALUE : null)
                              }
                              items={items}
                              onValueChange={(value) => {
                                if (value === SKIP_FIELD_VALUE) {
                                  updateConnection(
                                    skipNotebaseFields(sanitizedConnection, [field.id]),
                                  )
                                  return
                                }

                                const column = schemaQuery.data.notebaseColumns.find(
                                  (item: NotebaseColumn) => item.id === value,
                                )
                                if (column) {
                                  updateConnection(
                                    mapNotebaseField(sanitizedConnection, field.id, column),
                                  )
                                }
                              }}
                            >
                              <SelectTrigger
                                className={cn(
                                  "w-full",
                                  isUndecided && "border-warning bg-warning/5 text-warning",
                                  isSkipped && "border-dashed text-muted-foreground",
                                )}
                                aria-invalid={!!resolved && resolved.status !== "valid"}
                              >
                                <SelectValue placeholder={t("undecidedFieldPlaceholder")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {items.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>

                          {resolved && resolved.status !== "valid" && (
                            <p className="px-1 text-xs text-destructive">
                              {getMappingStatusMessage(resolved.status)}
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
