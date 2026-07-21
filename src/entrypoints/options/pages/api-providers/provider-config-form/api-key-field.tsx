import type { APIProviderConfig } from "@/types/config/provider"
import { Icon } from "@iconify/react"
import { useSelector } from "@tanstack/react-store"
import { useEffect, useEffectEvent, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Checkbox } from "@/components/ui/base-ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import { parseDeepLApiKeys, serializeDeepLApiKeys } from "@/utils/host/translate/api/deepl"
import { i18n } from "@/utils/i18n"
import { ConnectionTestButton } from "./components/connection-button"
import { withForm } from "./form"

interface ApiKeyRow {
  id: string
  value: string
}

let nextApiKeyRowId = 0

function createApiKeyRow(value = ""): ApiKeyRow {
  nextApiKeyRowId += 1
  return { id: `deepl-key-${nextApiKeyRowId}`, value }
}

function rowsFromApiKey(apiKey: string | undefined): ApiKeyRow[] {
  const keys = parseDeepLApiKeys(apiKey)
  return keys.length > 0 ? keys.map((value) => createApiKeyRow(value)) : [createApiKeyRow()]
}

function ShowAPIKeyCheckbox({
  id,
  showAPIKey,
  setShowAPIKey,
}: {
  id: string
  showAPIKey: boolean
  setShowAPIKey: (value: boolean) => void
}) {
  return (
    <div className="mt-0.5 flex items-center space-x-2">
      <Checkbox
        id={id}
        checked={showAPIKey}
        onCheckedChange={(checked) => setShowAPIKey(checked)}
      />
      <label
        htmlFor={id}
        className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {i18n.t("options.apiProviders.apiKey.showAPIKey")}
      </label>
    </div>
  )
}

function DeepLMultiKeyEditor({
  providerId,
  apiKey,
  providerConfig,
  showAPIKey,
  onCommit,
}: {
  providerId: string
  apiKey: string | undefined
  providerConfig: APIProviderConfig
  showAPIKey: boolean
  onCommit: (value: string) => void
}) {
  const [rows, setRows] = useState(() => rowsFromApiKey(apiKey))

  // Reset row UI when switching providers; keep local empty rows while typing.
  // useEffectEvent always reads the latest apiKey for the new provider.
  const resetRows = useEffectEvent(() => {
    setRows(rowsFromApiKey(apiKey))
  })

  useEffect(() => {
    resetRows()
  }, [providerId])

  const persistRows = (nextRows: ApiKeyRow[]) => {
    setRows(nextRows)
    onCommit(serializeDeepLApiKeys(nextRows.map((row) => row.value)))
  }

  const updateRow = (id: string, value: string) => {
    persistRows(rows.map((row) => (row.id === id ? { ...row, value } : row)))
  }

  const addRow = () => {
    setRows([...rows, createApiKeyRow()])
  }

  const removeRow = (id: string) => {
    if (rows.length <= 1) return
    persistRows(rows.filter((row) => row.id !== id))
  }

  return (
    <Field>
      <div className="flex w-full items-end justify-between">
        <FieldLabel nativeLabel={false} render={<div />}>
          API Key
        </FieldLabel>
        <ConnectionTestButton providerConfig={providerConfig} />
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => {
          const isLast = index === rows.length - 1
          return (
            <div key={row.id} className="flex items-center gap-2">
              <Input
                type={showAPIKey ? "text" : "password"}
                value={row.value}
                onChange={(e) => updateRow(row.id, e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={i18n.t("options.apiProviders.apiKey.removeKey")}
                  onClick={() => removeRow(row.id)}
                >
                  <Icon icon="tabler:trash" className="size-4" />
                </Button>
              )}
              {isLast && (
                <Button
                  type="button"
                  size="icon"
                  aria-label={i18n.t("options.apiProviders.apiKey.addKey")}
                  onClick={addRow}
                >
                  <Icon icon="tabler:plus" />
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </Field>
  )
}

export const APIKeyField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const [showAPIKey, setShowAPIKey] = useState(false)
    const providerConfig = useSelector(form.store, (state) => state.values)

    const providerType = providerConfig.provider
    if (providerType === "ollama") {
      return <></>
    }

    return (
      <form.AppField name="apiKey">
        {(field) => (
          <div className="flex flex-col gap-2">
            {providerType === "deepl" ? (
              <DeepLMultiKeyEditor
                providerId={providerConfig.id}
                apiKey={typeof field.state.value === "string" ? field.state.value : undefined}
                providerConfig={providerConfig}
                showAPIKey={showAPIKey}
                onCommit={(value) => {
                  field.handleChange(value)
                  void form.handleSubmit()
                }}
              />
            ) : (
              <field.InputFieldAutoSave
                formForSubmit={form}
                label="API Key"
                labelExtra={<ConnectionTestButton providerConfig={providerConfig} />}
                type={showAPIKey ? "text" : "password"}
              />
            )}
            <ShowAPIKeyCheckbox
              id={`apiKey-${providerConfig.id}`}
              showAPIKey={showAPIKey}
              setShowAPIKey={setShowAPIKey}
            />
          </div>
        )}
      </form.AppField>
    )
  },
})
