/**
 * CSS Linter for CodeMirror
 *
 * Provides real-time CSS syntax validation in the editor.
 * Can also be used standalone for validation outside the editor.
 */
import { linter } from "@codemirror/lint";
import * as csstree from "css-tree";
/**
 * Lint CSS and return errors
 * Can be used standalone without CodeMirror
 */
export function lintCSS(css) {
    const errors = [];
    if (!css.trim()) {
        return { valid: true, errors: [] };
    }
    try {
        // Parse CSS with strict mode to catch all errors
        csstree.parse(css, {
            parseAtrulePrelude: true,
            parseRulePrelude: true,
            parseValue: true,
            parseCustomProperty: true,
            onParseError: (error) => {
                const err = error;
                errors.push({
                    message: error.message,
                    line: err.line || 1,
                    column: err.column || 1,
                    severity: "error",
                });
            },
        });
        // If parsing succeeded but there were errors in onParseError, the CSS is invalid
        // css-tree can recover from some errors, but we want to report them all
    }
    catch (error) {
        // Catch fatal parsing errors (e.g., completely broken CSS)
        const err = error;
        errors.push({
            message: err.message || `Failed to parse CSS: ${error.message}`,
            line: err.line || 1,
            column: err.column || 1,
            severity: "error",
        });
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
/**
 * CodeMirror linter extension
 * Shows syntax errors with red squiggly lines in the editor
 */
export function cssLinter() {
    return linter((view) => {
        const diagnostics = [];
        const css = view.state.doc.toString();
        const result = lintCSS(css);
        for (const error of result.errors) {
            // Convert line/column to document position
            const line = view.state.doc.line(error.line);
            const from = line.from + error.column - 1;
            const to = Math.min(from + 10, line.to); // Highlight ~10 chars or until end of line
            diagnostics.push({
                from,
                to,
                severity: error.severity,
                message: error.message,
            });
        }
        return diagnostics;
    });
}
