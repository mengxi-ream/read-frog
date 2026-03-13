import type { SelectionToolbarCustomFeatureOutputField } from "@/types/config/selection-toolbar"
import { SelectionSourceContent } from "../../components/selection-source-content"
import { StructuredObjectRenderer } from "./structured-object-renderer"

interface CustomFeatureContentProps {
  errorMessage: string | null
  isRunning: boolean
  outputSchema: SelectionToolbarCustomFeatureOutputField[]
  selectionContent: string | null | undefined
  value: Record<string, unknown> | null
}

export function CustomFeatureContent({
  errorMessage,
  isRunning,
  outputSchema,
  selectionContent,
  value,
}: CustomFeatureContentProps) {
  return (
    <div className="p-4">
      <SelectionSourceContent
        text={selectionContent}
        emptyPlaceholder="—"
        separatorClassName="mb-4"
      />

      <div className="space-y-4">
        <StructuredObjectRenderer
          outputSchema={outputSchema}
          value={value}
          isStreaming={isRunning}
        />

        {isRunning && (
          <p className="text-xs text-zinc-500 dark:text-zinc-500">Streaming structured output…</p>
        )}

        {errorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  )
}
