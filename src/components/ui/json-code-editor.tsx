/**
 * JSON Code Editor Component
 *
 * CodeMirror-based code editor for JSON with syntax highlighting and theme support.
 * Uses @uiw/react-codemirror with @codemirror/lang-json for rich editing experience.
 */

import type { ReactCodeMirrorProps } from '@uiw/react-codemirror'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { linter, lintGutter } from '@codemirror/lint'
import CodeMirror from '@uiw/react-codemirror'
import { useTheme } from '@/components/providers/theme-provider'
import { cn } from '@/utils/styles/tailwind'

// Custom linter that allows empty content (jsonParseLinter throws on empty string)
const allowEmptyJsonLinter = linter((view) => {
  const content = view.state.doc.toString().trim()
  if (!content) {
    return []
  }
  return jsonParseLinter()(view)
})

interface JSONCodeEditorProps extends Omit<ReactCodeMirrorProps, 'theme' | 'extensions'> {
  hasError?: boolean
}

export function JSONCodeEditor({ hasError, className, editable = true, ...props }: JSONCodeEditorProps) {
  const { theme } = useTheme()

  return (
    <CodeMirror
      extensions={[
        json(),
        allowEmptyJsonLinter,
        lintGutter(),
      ]}
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
        'overflow-hidden rounded-md border',
        'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
        hasError && 'border-destructive focus-within:border-destructive focus-within:ring-destructive/50',
        !editable && 'opacity-50 cursor-not-allowed',
        className,
      )}
      style={{
        fontSize: 14,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", "Courier New", monospace',
      }}
      editable={editable}
      {...props}
    />
  )
}

JSONCodeEditor.displayName = 'JSONCodeEditor'
