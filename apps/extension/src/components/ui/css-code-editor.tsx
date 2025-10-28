/**
 * CSS Code Editor Component
 *
 * CodeMirror-based code editor for CSS with syntax highlighting and theme support.
 * Uses @uiw/react-codemirror with @codemirror/lang-css for rich editing experience.
 *
 * This editor wraps user input with a CSS selector to provide proper autocompletion,
 * but only saves the rules inside the brackets.
 */

import { css } from '@codemirror/lang-css'
import { lintGutter } from '@codemirror/lint'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { cn } from '@repo/ui/lib/utils'
import { color } from '@uiw/codemirror-extensions-color'
import CodeMirror from '@uiw/react-codemirror'
import { useTheme } from '@/components/providers/theme-provider'
import { CUSTOM_TRANSLATION_NODE_ATTRIBUTE } from '@/utils/constants/translation-node-style'
import { cssLinter } from '@/utils/css/lint-css'

interface CSSCodeEditorProps {
  value: string
  onChange: (value: string) => void
  hasError?: boolean
  className?: string
  disabled?: boolean
  placeholder?: string
}

export function CSSCodeEditor({ value, onChange, hasError, className, disabled, ...props }: CSSCodeEditorProps) {
  const { theme } = useTheme()

  // Wrap the value with a CSS selector for proper syntax highlighting and autocompletion
  const selector = `[data-${CUSTOM_TRANSLATION_NODE_ATTRIBUTE}="custom"]`
  const wrappedValue = `${selector} {\n${value}\n}`

  // Calculate the readonly ranges
  const selectorLineLength = selector.length + 3 // selector + " {\n"
  const closingBracePos = wrappedValue.length - 1 // position of final "}"

  // Extract the content inside the braces when the value changes
  const handleChange = (newValue: string) => {
    const match = newValue.match(/\{([\s\S]*)\}/)
    if (match) {
      // Remove leading/trailing newlines but preserve user's internal formatting
      const extracted = match[1].replace(/^\n+|\n+$/g, '')
      onChange(extracted)
    }
  }

  return (
    <CodeMirror
      value={wrappedValue}
      extensions={[
        color,
        css(),
        // CSS syntax linter - shows red squiggly lines for errors
        // The linter runs on the wrapped CSS (with selector), so syntax checking works properly
        cssLinter(),
        lintGutter(),
        // Prevent editing the selector and closing brace
        EditorState.changeFilter.of((tr) => {
          // Allow programmatic updates (when value prop changes)
          if (!tr.docChanged) {
            return true
          }

          // Block changes to the first line (selector + opening brace) and last line (closing brace)
          let blockChange = false
          tr.changes.iterChanges((fromA, toA) => {
            // Check if change affects first line or last line
            if (fromA < selectorLineLength || toA > closingBracePos) {
              blockChange = true
            }
          })

          return !blockChange
        }),
        // Add readonly styling to the selector line
        EditorView.baseTheme({
          '.cm-line:first-child': {
            backgroundColor: 'var(--muted)',
            opacity: '0.6',
            userSelect: 'none',
          },
          '.cm-line:last-child': {
            backgroundColor: 'var(--muted)',
            opacity: '0.6',
            userSelect: 'none',
          },
        }),
      ]}
      onChange={handleChange}
      editable={!disabled}
      theme={theme}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightActiveLine: true,
        foldGutter: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        syntaxHighlighting: true,
      }}
      className={cn(
        'rounded-md border',
        'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
        hasError && 'border-destructive focus-within:border-destructive focus-within:ring-destructive/50',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      style={{
        fontSize: 14,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", "Courier New", monospace',
      }}
      {...props}
    />
  )
}

CSSCodeEditor.displayName = 'CSSCodeEditor'
