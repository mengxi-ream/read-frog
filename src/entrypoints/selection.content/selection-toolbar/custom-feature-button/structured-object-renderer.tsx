import type { Spec } from "@json-render/react"
import type { ThinkingSnapshot } from "@/types/background-stream"
import type {
  SelectionToolbarCustomFeatureOutputField,
  SelectionToolbarCustomFeatureOutputType,
} from "@/types/config/selection-toolbar"
import { defineCatalog } from "@json-render/core"
import { defineRegistry, JSONUIProvider, Renderer } from "@json-render/react"
import { schema as reactSchema } from "@json-render/react/schema"
import { IconHash, IconTypography } from "@tabler/icons-react"
import { useMemo } from "react"
import { z } from "zod"
import { Thinking } from "@/components/thinking"

interface StructuredObjectRendererProps {
  outputSchema: SelectionToolbarCustomFeatureOutputField[]
  value: Record<string, unknown> | null
  isStreaming?: boolean
  thinking: ThinkingSnapshot | null
}

function formatFieldValue(value: unknown, type: SelectionToolbarCustomFeatureOutputField["type"]) {
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
  outputSchema: SelectionToolbarCustomFeatureOutputField[],
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

function getFieldTypeIcon(type: SelectionToolbarCustomFeatureOutputType) {
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
      const { label, type, value, pending } = props

      return (
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            {getFieldTypeIcon(type)}
            <span>{label}</span>
          </div>
          <div className="text-sm whitespace-pre-wrap wrap-break-words">
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
