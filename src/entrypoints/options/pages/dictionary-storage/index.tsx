import type {
  CustomActionResultRecord,
  CustomActionResultStorageSettings,
} from "@/utils/custom-action-result-storage/types"
import type { CustomActionResultStorageResponse } from "@/utils/custom-action-result-storage/types"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Input } from "@/components/ui/base-ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { toastManager } from "@/components/ui/base-ui/toast"
import { getCustomActionResultStorageErrorMessage } from "@/utils/custom-action-result-storage/error-message"
import {
  getCustomActionResultStorageSettings,
  setCustomActionResultStorageSettings,
} from "@/utils/custom-action-result-storage/settings"
import { DEFAULT_CUSTOM_ACTION_RESULT_STORAGE_SETTINGS } from "@/utils/custom-action-result-storage/types"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { ConfigSection } from "../../components/config-section"
import { PageLayout } from "../../components/page-layout"

export function DictionaryStoragePage() {
  const [settings, setSettings] = useState<CustomActionResultStorageSettings>(
    DEFAULT_CUSTOM_ACTION_RESULT_STORAGE_SETTINGS,
  )
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testStatus, setTestStatus] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true
    void getCustomActionResultStorageSettings()
      .then((value) => {
        if (active) setSettings(value)
      })
      .catch(() => {
        if (active) setTestStatus(i18n.t("options.dictionaryStorage.loadFailed"))
      })
      .finally(() => {
        if (active) setIsLoaded(true)
      })
    return () => {
      active = false
    }
  }, [])

  const recordsQueryKey = ["custom-action-result-storage", "records", settings.provider]
  const recordsQuery = useQuery({
    queryKey: recordsQueryKey,
    queryFn: async () => await sendMessage("listCustomActionResults", undefined),
    enabled: isLoaded && settings.provider !== "notebase",
    retry: false,
  })
  const records = recordsQuery.data?.ok ? recordsQuery.data.value : []
  const isLoadingRecords = recordsQuery.isLoading || recordsQuery.isFetching
  const recordsError =
    recordsQuery.data && !recordsQuery.data.ok
      ? getCustomActionResultStorageErrorMessage(recordsQuery.data.error)
      : recordsQuery.error
        ? i18n.t("action.customActionResultStorageErrorGeneric")
        : null

  const saveSettings = async (nextSettings = settings) => {
    setIsSavingSettings(true)
    try {
      await setCustomActionResultStorageSettings(nextSettings)
      setSettings(nextSettings)
      return true
    } catch {
      toastManager.add({
        type: "error",
        title: i18n.t("options.dictionaryStorage.saveFailed"),
      })
      return false
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleProviderChange = (value: string | null) => {
    if (value !== "notebase" && value !== "local" && value !== "webdav") return
    const nextSettings: CustomActionResultStorageSettings = { ...settings, provider: value }
    setTestStatus(null)
    void saveSettings(nextSettings)
  }

  const handleTestConnection = async () => {
    if (!(await saveSettings())) return
    setIsTesting(true)
    setTestStatus(null)
    try {
      const response = await sendMessage("testWebDavCustomActionResultStorage", undefined)
      setTestStatus(
        response.ok
          ? i18n.t("options.dictionaryStorage.webdav.testSucceeded")
          : getCustomActionResultStorageErrorMessage(response.error),
      )
    } catch {
      setTestStatus(i18n.t("action.customActionResultStorageErrorGeneric"))
    } finally {
      setIsTesting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const response = await sendMessage("deleteCustomActionResult", { id })
      if (!response.ok) {
        toastManager.add({
          type: "error",
          title: getCustomActionResultStorageErrorMessage(response.error),
        })
        return
      }
      queryClient.setQueryData<CustomActionResultStorageResponse<CustomActionResultRecord[]>>(
        recordsQueryKey,
        (current) =>
          current?.ok
            ? { ok: true, value: current.value.filter((record) => record.id !== id) }
            : current,
      )
    } catch {
      toastManager.add({
        type: "error",
        title: i18n.t("action.customActionResultStorageErrorGeneric"),
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <PageLayout
      title={i18n.t("options.dictionaryStorage.title")}
      description={i18n.t("options.dictionaryStorage.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <ConfigSection title={i18n.t("options.dictionaryStorage.provider.title")}>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {i18n.t("options.dictionaryStorage.provider.description")}
          </p>
          <Select value={settings.provider} onValueChange={handleProviderChange}>
            <SelectTrigger
              aria-label={i18n.t("options.dictionaryStorage.provider.title")}
              className="w-full max-w-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="notebase">
                {i18n.t("options.dictionaryStorage.provider.notebase")}
              </SelectItem>
              <SelectItem value="local">
                {i18n.t("options.dictionaryStorage.provider.local")}
              </SelectItem>
              <SelectItem value="webdav">
                {i18n.t("options.dictionaryStorage.provider.webdav")}
              </SelectItem>
            </SelectContent>
          </Select>
          {settings.provider === "notebase" && (
            <p className="text-sm text-muted-foreground">
              {i18n.t("options.dictionaryStorage.provider.notebaseDescription")}
            </p>
          )}
          {settings.provider === "local" && (
            <p className="text-sm text-muted-foreground">
              {i18n.t("options.dictionaryStorage.provider.localDescription")}
            </p>
          )}
        </div>
      </ConfigSection>

      {settings.provider === "webdav" && (
        <ConfigSection title={i18n.t("options.dictionaryStorage.webdav.title")}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {i18n.t("options.dictionaryStorage.webdav.description")}
            </p>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {i18n.t("options.dictionaryStorage.webdav.serverUrl")}
              <Input
                autoComplete="url"
                inputMode="url"
                value={settings.webDav.serverUrl}
                placeholder="https://dav.example.com/remote.php/dav/files/user"
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    webDav: { ...settings.webDav, serverUrl: event.currentTarget.value },
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {i18n.t("options.dictionaryStorage.webdav.directory")}
              <Input
                value={settings.webDav.directory}
                placeholder="Read Frog"
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    webDav: { ...settings.webDav, directory: event.currentTarget.value },
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {i18n.t("options.dictionaryStorage.webdav.username")}
              <Input
                autoComplete="username"
                value={settings.webDav.username}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    webDav: { ...settings.webDav, username: event.currentTarget.value },
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {i18n.t("options.dictionaryStorage.webdav.password")}
              <Input
                type="password"
                autoComplete="new-password"
                value={settings.webDav.password}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    webDav: { ...settings.webDav, password: event.currentTarget.value },
                  })
                }
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSavingSettings}
                onClick={() => void saveSettings()}
              >
                {i18n.t("options.dictionaryStorage.webdav.save")}
              </Button>
              <Button
                type="button"
                disabled={isSavingSettings || isTesting}
                onClick={() => void handleTestConnection()}
              >
                {i18n.t(
                  isTesting
                    ? "options.dictionaryStorage.webdav.testing"
                    : "options.dictionaryStorage.webdav.test",
                )}
              </Button>
              {testStatus && (
                <span role="status" className="text-sm text-muted-foreground">
                  {testStatus}
                </span>
              )}
            </div>
          </div>
        </ConfigSection>
      )}

      <ConfigSection title={i18n.t("options.dictionaryStorage.records.title")}>
        {settings.provider === "notebase" ? (
          <p className="text-sm text-muted-foreground">
            {i18n.t("options.dictionaryStorage.records.notebaseDescription")}
          </p>
        ) : isLoadingRecords ? (
          <p role="status" className="text-sm text-muted-foreground">
            {i18n.t("options.dictionaryStorage.records.loading")}
          </p>
        ) : recordsError ? (
          <p role="alert" className="text-sm text-destructive">
            {recordsError}
          </p>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {i18n.t("options.dictionaryStorage.records.empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {records.map((record) => (
              <SavedRecordCard
                key={record.id}
                record={record}
                isDeleting={deletingId === record.id}
                onDelete={() => void handleDelete(record.id)}
              />
            ))}
          </div>
        )}
      </ConfigSection>
    </PageLayout>
  )
}

function SavedRecordCard({
  record,
  isDeleting,
  onDelete,
}: {
  record: CustomActionResultRecord
  isDeleting: boolean
  onDelete: () => void
}) {
  const sourceUrl = getSafeSourceUrl(record.sourceUrl)
  const fields = getRecordFieldsJson(record.fields)

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium">{record.sourceTitle || record.customActionName}</h3>
          <p className="text-xs text-muted-foreground">
            {record.customActionName} · {new Date(record.createdAt).toLocaleString()}
          </p>
          {sourceUrl && (
            <a
              className="mt-1 block truncate text-xs text-link underline"
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {sourceUrl}
            </a>
          )}
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isDeleting}
          onClick={onDelete}
        >
          {i18n.t(
            isDeleting
              ? "options.dictionaryStorage.records.deleting"
              : "options.dictionaryStorage.records.delete",
          )}
        </Button>
      </div>
      <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs break-words whitespace-pre-wrap">
        {fields}
      </pre>
    </article>
  )
}

function getRecordFieldsJson(fields: Record<string, unknown>): string {
  try {
    return JSON.stringify(fields, null, 2) ?? ""
  } catch {
    return i18n.t("options.dictionaryStorage.records.fieldsUnavailable")
  }
}

function getSafeSourceUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}
