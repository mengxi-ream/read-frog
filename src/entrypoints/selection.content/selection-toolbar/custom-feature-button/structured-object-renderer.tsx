import type { ComponentRegistry, Spec } from "@json-render/react"
import type { SelectionToolbarCustomFeatureOutputField } from "@/types/config/selection-toolbar"
import { JSONUIProvider, Renderer } from "@json-render/react"
import { useMemo } from "react"

interface StructuredObjectRendererProps {
  outputSchema: SelectionToolbarCustomFeatureOutputField[]
  value: Record<string, unknown> | null
  isStreaming?: boolean
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

const STRUCTURED_OBJECT_REGISTRY: ComponentRegistry = {
  ObjectContainer: ({ children }) => (
    <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
      {children}
    </div>
  ),
  FieldRow: ({ element }) => {
    const { label, value, pending } = element.props as {
      label: string
      value: string
      pending?: boolean
    }

    return (
      <div className="grid grid-cols-[minmax(120px,1fr)_2fr] gap-3 border-b border-zinc-200 p-3 last:border-b-0 dark:border-zinc-700">
        <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
        <div className="text-sm whitespace-pre-wrap break-words text-zinc-900 dark:text-zinc-100">
          {pending ? "…" : value || "—"}
        </div>
      </div>
    )
  },
}

export function StructuredObjectRenderer({
  outputSchema,
  value,
  isStreaming = false,
}: StructuredObjectRendererProps) {
  const spec = useMemo(
    () => buildStructuredObjectSpec(outputSchema, value, isStreaming),
    [outputSchema, value, isStreaming],
  )

  return (
    <JSONUIProvider registry={STRUCTURED_OBJECT_REGISTRY} initialState={{}}>
      <Renderer spec={spec} registry={STRUCTURED_OBJECT_REGISTRY} loading={isStreaming} />
    </JSONUIProvider>
  )
}
