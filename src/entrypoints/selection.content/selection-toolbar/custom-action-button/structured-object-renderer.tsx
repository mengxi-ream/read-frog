import type { Spec } from "@json-render/react"
import type { ThinkingSnapshot } from "@/types/background-stream"
import type {
  SelectionToolbarCustomActionOutputField,
  SelectionToolbarCustomActionOutputType,
} from "@/types/config/selection-toolbar"
import { defineCatalog } from "@json-render/core"
import { defineRegistry, JSONUIProvider, Renderer } from "@json-render/react"
import { schema as reactSchema } from "@json-render/react/schema"
import { IconHash, IconTypography } from "@tabler/icons-react"
import { useMemo } from "react"
import { z } from "zod"
import { Thinking } from "@/components/thinking"
import { FieldSpeakButton } from "./field-speak-button"

interface StructuredObjectRendererProps {
  outputSchema: SelectionToolbarCustomActionOutputField[]
  value: Record<string, unknown> | null
  isStreaming?: boolean
  thinking: ThinkingSnapshot | null
}

function formatFieldValue(value: unknown, type: SelectionToolbarCustomActionOutputField["type"]) {
  if (value === null || value === undefined) {
    return ""
  }

  if (type === "number") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value)
    }

    const parsed = Number(value)
    return Number.isFinite(parsed) ? String(parsed) : String(value)
  }

  return typeof value === "string" ? value : String(value)
}

function buildStructuredObjectSpec(
  outputSchema: SelectionToolbarCustomActionOutputField[],
  value: Record<string, unknown> | null,
  isStreaming: boolean,
): Spec {
  const rootKey = "root"
  const childKeys: string[] = []
  const elements: Spec["elements"] = {}

  outputSchema.forEach((field) => {
    const elementKey = `field-${field.id}`
    childKeys.push(elementKey)

    const rawValue = value?.[field.name]
    const displayValue = formatFieldValue(rawValue, field.type)
    const isPending = rawValue === undefined && isStreaming

    elements[elementKey] = {
      type: "FieldRow",
      props: {
        label: field.name,
        type: field.type,
        value: displayValue,
        pending: isPending,
        speakingEnabled: field.speaking,
      },
      children: [],
    }
  })

  elements[rootKey] = {
    type: "ObjectContainer",
    props: {},
    children: childKeys,
  }

  return {
    root: rootKey,
    elements,
  }
}

function getFieldTypeIcon(type: SelectionToolbarCustomActionOutputType) {
  if (type === "number") {
    return <IconHash className="size-3 shrink-0" strokeWidth={1.8} />
  }

  return <IconTypography className="size-3 shrink-0" strokeWidth={1.8} />
}

const structuredObjectCatalog = defineCatalog(reactSchema, {
  components: {
    ObjectContainer: {
      props: z.object({}),
      slots: ["default"],
      description: "Container for a rendered structured object",
    },
    FieldRow: {
      props: z.object({
        label: z.string(),
        type: z.enum(["string", "number"]),
        value: z.string(),
        pending: z.boolean(),
        speakingEnabled: z.boolean(),
      }),
      description: "Single row in a structured object output",
    },
  },
  actions: {},
})

const { registry: STRUCTURED_OBJECT_REGISTRY } = defineRegistry(structuredObjectCatalog, {
  components: {
    ObjectContainer: ({ children }) => <div className="space-y-3">{children}</div>,
    FieldRow: ({ props }) => {
      const { label, type, value, pending, speakingEnabled } = props
      const speakButtonDisabled = pending || value.length === 0

      return (
        <div className="" data-slot="custom-action-field-row" data-field-name={label}>
          <div className="flex items-center gap-0.5 h-6">
            <div className="inline-flex min-w-0 items-center gap-0.5 text-xs font-medium text-muted-foreground">
              {getFieldTypeIcon(type)}
              <span className="truncate">{label}</span>
            </div>
            {speakingEnabled && (
              <FieldSpeakButton text={value} disabled={speakButtonDisabled} />
            )}
          </div>
          <div className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {pending ? "…" : value || "—"}
          </div>
        </div>
      )
    },
  },
})

export function StructuredObjectRenderer({
  outputSchema,
  value,
  isStreaming = false,
  thinking,
}: StructuredObjectRendererProps) {
  const spec = useMemo(
    () => buildStructuredObjectSpec(outputSchema, value, isStreaming),
    [outputSchema, value, isStreaming],
  )

  return (
    <div className="space-y-2">
      {thinking && (
        <Thinking status={thinking.status} content={thinking.text} />
      )}
      <JSONUIProvider registry={STRUCTURED_OBJECT_REGISTRY} initialState={{}}>
        <Renderer spec={spec} registry={STRUCTURED_OBJECT_REGISTRY} loading={isStreaming} />
      </JSONUIProvider>
    </div>
  )
}
