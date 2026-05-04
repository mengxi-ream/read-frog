import type { ReactNode } from "react"
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { Field, FieldError, FieldLabel } from "@/components/ui/base-ui/field"
import { JSONCodeEditor } from "@/components/ui/json-code-editor"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

export type JsonEditorParseResult<TValue>
  = | { valid: true, value: TValue | undefined }
    | { valid: false, error: string }

interface AutosavedJsonCodeEditorFieldProps<TValue extends Record<string, unknown>> {
  value: TValue | undefined
  label: ReactNode
  placeholder: string
  editorAriaLabel: string
  resetKey: string
  syncSignal?: unknown
  parse: (input: string) => JsonEditorParseResult<TValue>
  onCommit: (value: TValue | undefined) => void
  onSubmit: () => void | Promise<void>
  serialize?: (value: TValue | undefined) => string
  height?: string
}

function defaultSerializeJson<TValue extends Record<string, unknown>>(value: TValue | undefined) {
  return value ? JSON.stringify(value, null, 2) : ""
}

export function AutosavedJsonCodeEditorField<TValue extends Record<string, unknown>>({
  value,
  label,
  placeholder,
  editorAriaLabel,
  resetKey,
  syncSignal = value,
  parse,
  onCommit,
  onSubmit,
  serialize = defaultSerializeJson,
  height = "150px",
}: AutosavedJsonCodeEditorFieldProps<TValue>) {
  const externalJson = serialize(value)
  const [jsonInput, setJsonInput] = useState(() => externalJson)
  const lastCommittedJsonRef = useRef(externalJson)
  const pendingEditorCommitRef = useRef(false)
  const editorFocusedRef = useRef(false)

  const syncJsonInput = useEffectEvent((nextJson: string) => {
    // eslint-disable-next-line react/set-state-in-effect
    setJsonInput(nextJson)
  })

  const resetSyncState = useEffectEvent(() => {
    lastCommittedJsonRef.current = externalJson
    pendingEditorCommitRef.current = false
    syncJsonInput(externalJson)
  })

  const readJsonInput = useEffectEvent(() => jsonInput)

  const handleJsonInputChange = useCallback((nextJson: string) => {
    setJsonInput(nextJson)
  }, [])

  const handleEditorFocus = useCallback(() => {
    editorFocusedRef.current = true
  }, [])

  const handleEditorBlur = useCallback(() => {
    editorFocusedRef.current = false
  }, [])

  useEffect(() => {
    resetSyncState()
  }, [resetKey])

  useEffect(() => {
    if (pendingEditorCommitRef.current && externalJson === lastCommittedJsonRef.current) {
      pendingEditorCommitRef.current = false
      return
    }

    pendingEditorCommitRef.current = false

    const currentJsonInput = readJsonInput()
    if (editorFocusedRef.current && currentJsonInput !== lastCommittedJsonRef.current) {
      return
    }

    lastCommittedJsonRef.current = externalJson

    if (currentJsonInput !== externalJson) {
      syncJsonInput(externalJson)
    }
  }, [syncSignal, externalJson])

  const debouncedJsonInput = useDebouncedValue(jsonInput, 500)
  const parseResult = useMemo(() => parse(debouncedJsonInput), [debouncedJsonInput, parse])

  useEffect(() => {
    if (!parseResult.valid) {
      return
    }

    const normalizedJson = serialize(parseResult.value)
    if (normalizedJson === lastCommittedJsonRef.current) {
      return
    }

    lastCommittedJsonRef.current = normalizedJson
    pendingEditorCommitRef.current = true
    onCommit(parseResult.value)
    void onSubmit()
  }, [onCommit, onSubmit, parseResult, serialize])

  const jsonError = !parseResult.valid ? parseResult.error : null

  return (
    <Field invalid={!!jsonError}>
      <FieldLabel>{label}</FieldLabel>
      <JSONCodeEditor
        aria-label={editorAriaLabel}
        value={jsonInput}
        onChange={handleJsonInputChange}
        onFocus={handleEditorFocus}
        onBlur={handleEditorBlur}
        placeholder={placeholder}
        hasError={!!jsonError}
        height={height}
      />
      {jsonError && (
        <FieldError match={!!jsonError}>{jsonError}</FieldError>
      )}
    </Field>
  )
}
