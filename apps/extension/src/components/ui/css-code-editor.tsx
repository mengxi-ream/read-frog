/**
 * CSS Code Editor Component
 *
 * CodeMirror-based code editor for CSS with syntax highlighting and theme support.
 * Uses @uiw/react-codemirror with @codemirror/lang-css for rich editing experience.
 */

import type { ReactCodeMirrorProps } from '@uiw/react-codemirror'
import { css } from '@codemirror/lang-css'
import { lintGutter } from '@codemirror/lint'
import { cn } from '@repo/ui/lib/utils'
import { color } from '@uiw/codemirror-extensions-color'
import CodeMirror from '@uiw/react-codemirror'
import { useTheme } from '@/components/providers/theme-provider'
import { cssLinter } from '@/utils/css/lint-css'

interface CSSCodeEditorProps extends Omit<ReactCodeMirrorProps, 'theme' | 'extensions'> {
  hasError?: boolean
}

export function CSSCodeEditor({ hasError, className, editable = true, ...props }: CSSCodeEditorProps) {
  const { theme } = useTheme()

  return (
    <CodeMirror
      extensions={[
        color,
        css(),
        // CSS syntax linter - shows red squiggly lines for errors
        cssLinter(),
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
        'rounded-md border',
        'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
        hasError && 'border-destructive focus-within:border-destructive focus-within:ring-destructive/50',
        !editable && 'opacity-50 cursor-not-allowed',
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
