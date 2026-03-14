import type { ThinkingSnapshot } from "@/types/background-stream"
import type { SelectionToolbarCustomActionOutputField } from "@/types/config/selection-toolbar"
import { SelectionSourceContent } from "../../components/selection-source-content"
import { StructuredObjectRenderer } from "./structured-object-renderer"

interface CustomActionContentProps {
  isRunning: boolean
  outputSchema: SelectionToolbarCustomActionOutputField[]
  selectionContent: string | null | undefined
  value: Record<string, unknown> | null
  thinking: ThinkingSnapshot | null
}

export function CustomActionContent({
  isRunning,
  outputSchema,
  selectionContent,
  value,
  thinking,
}: CustomActionContentProps) {
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
          thinking={thinking}
        />
      </div>
    </div>
  )
}
