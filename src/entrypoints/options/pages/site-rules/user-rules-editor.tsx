/**
 * User Site Rules Editor
 *
 * JSON editor for `config.siteRules.userRules` with live validation and an
 * explicit Save button (same architecture as the custom translation CSS
 * editor: 500ms debounced validation, Save/Saved label, status line).
 */

import type { UserRulesValidationErrorKind, UserRulesValidationResult } from "./validate-user-rules"
import { Icon } from "@iconify/react"
import { useAtom } from "jotai"
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/base-ui/alert"
import { Button } from "@/components/ui/base-ui/button"
import { JSONCodeEditor } from "@/components/ui/json-code-editor"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { ConfigCard } from "../../components/config-card"
import { validateUserRulesDocument } from "./validate-user-rules"

const MAX_VISIBLE_ISSUES = 5

const VALIDATION_ERROR_MESSAGE_KEYS = {
  syntax: "options.siteRules.userRules.validation.syntaxError",
  notArray: "options.siteRules.userRules.validation.notArray",
  tooLong: "options.siteRules.userRules.validation.tooLong",
  tooMany: "options.siteRules.userRules.validation.tooMany",
  schema: "options.siteRules.userRules.validation.schemaErrors",
  duplicateIds: "options.siteRules.userRules.validation.duplicateIds",
} as const satisfies Record<UserRulesValidationErrorKind, string>

export function UserRulesEditor() {
  const [siteRules, setSiteRules] = useAtom(configFieldsAtomMap.siteRules)
  const externalJson = useMemo(
    () => JSON.stringify(siteRules.userRules, null, 2),
    [siteRules.userRules],
  )
  const [jsonInput, setJsonInput] = useState(externalJson)

  // Re-sync the editor when the atom changes externally (config sync, another
  // tab) but only if the editor has no unsaved local edits, so typing is never
  // clobbered.
  const lastExternalJsonRef = useRef(externalJson)
  const syncFromExternal = useEffectEvent(() => {
    const previousExternalJson = lastExternalJsonRef.current
    lastExternalJsonRef.current = externalJson
    if (jsonInput === previousExternalJson && jsonInput !== externalJson) {
      setJsonInput(externalJson)
    }
  })
  useEffect(() => {
    syncFromExternal()
  }, [externalJson])

  const debouncedJsonInput = useDebouncedValue(jsonInput, 500)
  const validation = useMemo(
    () => validateUserRulesDocument(debouncedJsonInput),
    [debouncedJsonInput],
  )

  const isValidating = jsonInput !== debouncedJsonInput
  const hasChanges = jsonInput !== externalJson

  const handleSave = () => {
    if (!validation.ok || isValidating || !hasChanges) {
      return
    }

    // Normalize the editor to the canonical serialization so the editor text
    // matches `externalJson` once the write lands (Save flips to Saved).
    setJsonInput(JSON.stringify(validation.rules, null, 2))
    void setSiteRules({ ...siteRules, userRules: validation.rules })
  }

  return (
    <ConfigCard
      id="site-rules-user-rules"
      title={i18n.t("options.siteRules.userRules.title")}
      description={i18n.t("options.siteRules.userRules.description")}
      className="lg:flex-col lg:[&>div]:basis-auto"
    >
      <div className="flex flex-col gap-3">
        <JSONCodeEditor
          aria-label="site-rules-user-rules-editor"
          value={jsonInput}
          onChange={setJsonInput}
          hasError={!validation.ok}
          className="max-h-[400px] min-h-[200px] overflow-y-auto"
        />
        {!validation.ok && (
          <Alert variant="destructive">
            <Icon icon="tabler:alert-circle-filled" className="size-4" />
            <AlertTitle>{i18n.t(VALIDATION_ERROR_MESSAGE_KEYS[validation.kind])}</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc text-xs">
                {validation.issues.slice(0, MAX_VISIBLE_ISSUES).map((issue) => (
                  <li key={`${issue.path}-${issue.message}`}>
                    <code className="text-xs">{issue.path}</code>
                    {": "}
                    {issue.message}
                  </li>
                ))}
                {validation.issues.length > MAX_VISIBLE_ISSUES && (
                  <li>
                    {i18n.t("options.siteRules.userRules.validation.moreErrors", [
                      validation.issues.length - MAX_VISIBLE_ISSUES,
                    ])}
                  </li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-between gap-2">
          <div
            className={cn(
              "text-sm text-green-500",
              isValidating && "text-muted-foreground",
              !validation.ok && "text-destructive",
            )}
          >
            {getValidationMessage(validation, isValidating, hasChanges)}
          </div>
          <Button onClick={handleSave} disabled={isValidating || !validation.ok || !hasChanges}>
            {hasChanges
              ? i18n.t("options.siteRules.userRules.saveButton")
              : i18n.t("options.siteRules.userRules.savedButton")}
          </Button>
        </div>
      </div>
    </ConfigCard>
  )
}

function getValidationMessage(
  validation: UserRulesValidationResult,
  isValidating: boolean,
  hasChanges: boolean,
) {
  if (isValidating) {
    return i18n.t("options.siteRules.userRules.validation.validating")
  }

  if (!validation.ok) {
    return i18n.t(VALIDATION_ERROR_MESSAGE_KEYS[validation.kind])
  }

  if (!hasChanges) {
    return i18n.t("options.siteRules.userRules.validation.saved")
  }

  return i18n.t("options.siteRules.userRules.validation.valid")
}
