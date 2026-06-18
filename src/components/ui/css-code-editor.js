import { jsx as _jsx } from "react/jsx-runtime";
import { css } from "@codemirror/lang-css";
import { lintGutter } from "@codemirror/lint";
import { color } from "@uiw/codemirror-extensions-color";
import CodeMirror from "@uiw/react-codemirror";
import { useTheme } from "@/components/providers/theme-provider";
import { cssLinter } from "@/utils/css/lint-css";
import { cn } from "@/utils/styles/utils";
export function CSSCodeEditor({ hasError, className, editable = true, ...props }) {
    const { theme } = useTheme();
    return (_jsx(CodeMirror, { extensions: [
            color,
            css(),
            // CSS syntax linter - shows red squiggly lines for errors
            cssLinter(),
            lintGutter(),
        ], theme: theme, basicSetup: {
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightActiveLine: true,
            foldGutter: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            syntaxHighlighting: true,
        }, className: cn("overflow-hidden rounded-md border", "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]", hasError && "border-destructive focus-within:border-destructive focus-within:ring-destructive/50", !editable && "opacity-50 cursor-not-allowed", className), style: {
            fontSize: 14,
            fontFamily: "ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
        }, ...props }));
}
CSSCodeEditor.displayName = "CSSCodeEditor";
