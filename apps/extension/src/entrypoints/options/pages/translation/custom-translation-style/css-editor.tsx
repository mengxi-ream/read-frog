/**
 * CSS Editor Section Component
 *
 * Main editor interface with live validation and error display.
 * Features:
 * - Real-time CSS validation with 500ms debounce
 * - Save button with validation state
 */

import { i18n } from '#imports'
import { Button } from '@repo/ui/components/button'
import { Field, FieldLabel } from '@repo/ui/components/field'
import { cn } from '@repo/ui/lib/utils'
import { useAtom } from 'jotai'
import { Activity, useMemo, useState } from 'react'
import { CSSCodeEditor } from '@/components/ui/css-code-editor'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { MAX_CUSTOM_CSS_LENGTH } from '@/types/config/translate'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { WEBSITE_URL } from '@/utils/constants/url'
import { lintCSS } from '@/utils/css/lint-css'

export function CSSEditor() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { translationNodeStyle } = translateConfig
  const [cssInput, setCssInput] = useState(translateConfig.translationNodeStyle.customCSS ?? '')

  // Debounce CSS input for validation
  const debouncedCssInput = useDebouncedValue(cssInput, 500)

  // Check CSS syntax using linter
  // Wrap with a dummy selector so css-tree can parse it properly
  const syntaxCheck = useMemo(() => {
    if (!debouncedCssInput.trim()) {
      return { valid: true, errors: [] }
    }
    return lintCSS(debouncedCssInput)
  }, [debouncedCssInput])

  // Check CSS length
  const hasLengthError = debouncedCssInput.length > MAX_CUSTOM_CSS_LENGTH

  const hasSyntaxError = !syntaxCheck.valid
  const isValidating = cssInput !== debouncedCssInput
  const hasChanges = cssInput !== (translateConfig.translationNodeStyle.customCSS ?? '')

  const handleSave = () => {
    // Must pass syntax check and length check
    if (hasSyntaxError || hasLengthError || isValidating || !hasChanges) {
      return
    }

    // Save the original cssInput to preserve user's formatting and indentation
    void setTranslateConfig({
      ...translateConfig,
      translationNodeStyle: {
        ...translateConfig.translationNodeStyle,
        customCSS: cssInput,
      },
    })
  }

  return (
    <Activity mode={translationNodeStyle.isCustom ? 'visible' : 'hidden'}>
      <Field>
        <div className="flex items-start justify-between">
          <FieldLabel htmlFor="css-editor" data-invalid>
            {i18n.t('options.translation.translationStyle.cssEditor')}
          </FieldLabel>
          <a href={`${WEBSITE_URL}/tutorial/custom-css`} className="text-xs text-link hover:opacity-90" target="_blank" rel="noreferrer">
            {i18n.t('options.apiProviders.howToConfigure')}
          </a>
        </div>
        <CSSCodeEditor
          value={cssInput}
          onChange={setCssInput}
          hasError={hasSyntaxError || hasLengthError}
          placeholder={i18n.t('options.translation.translationStyle.customCSS.editor.placeholder')}
          className="min-h-[200px] max-h-[400px] overflow-y-auto"
        />
        {/* Show syntax errors */}
        {/* <Activity mode={hasSyntaxError ? 'visible' : 'hidden'}>
          <Alert variant="destructive">
            <Icon icon="tabler:exclamation-circle" className="size-4 text-destructive" />
            <AlertTitle>CSS Syntax Errors</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc text-sm">
                {syntaxCheck.errors.slice(0, 5).map((error, idx) => (
                  <li key={idx}>
                    Line
                    {' '}
                    {error.line}
                    :
                    {' '}
                    {error.message}
                  </li>
                ))}
                {syntaxCheck.errors.length > 5 && (
                  <li>
                    ... and
                    {' '}
                    {syntaxCheck.errors.length - 5}
                    {' '}
                    more errors
                  </li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        </Activity> */}
        <div className="flex items-center gap-2 justify-between">
          <div className={cn('text-sm text-green-500', isValidating && 'text-muted-foreground', (hasSyntaxError || hasLengthError) && 'text-destructive')}>
            {cssInput.trim().length > 0 ? getValidationMessage(isValidating, hasSyntaxError, hasLengthError, hasChanges) : ''}
          </div>
          <Button onClick={handleSave} disabled={isValidating || hasSyntaxError || hasLengthError || !hasChanges}>
            {hasChanges
              ? i18n.t('options.translation.translationStyle.customCSS.editor.saveButton')
              : i18n.t('options.translation.translationStyle.customCSS.editor.savedButton')}
          </Button>
        </div>
      </Field>
    </Activity>
  )
}

function getValidationMessage(isValidating: boolean, hasSyntaxError: boolean, hasLengthError: boolean, hasChanges: boolean) {
  if (isValidating) {
    return i18n.t('options.translation.translationStyle.customCSS.editor.validation.validating')
  }

  if (hasSyntaxError) {
    return i18n.t('options.translation.translationStyle.customCSS.editor.validation.syntaxError')
  }

  if (hasLengthError) {
    return i18n.t('options.translation.translationStyle.customCSS.editor.validation.tooLong')
  }

  if (!hasChanges) {
    return i18n.t('options.translation.translationStyle.customCSS.editor.validation.saved')
  }

  return i18n.t('options.translation.translationStyle.customCSS.editor.validation.valid')
}
