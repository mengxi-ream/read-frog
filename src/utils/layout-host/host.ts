import type { LayoutStatus } from "@read-frog/layout-engine/contract"
import type { LayoutScope } from "@read-frog/layout-engine/core"
import type { SelectionToolbarCustomActionOutputField } from "@/types/config/selection-toolbar"
import { defineLayoutHost } from "@read-frog/layout-engine/contract"
import { buildLayoutScope } from "@read-frog/layout-engine/core"
import { MAX_CUSTOM_ACTION_LAYOUT_LENGTH } from "@/types/config/selection-toolbar"

// What custom actions tell the layout engine about themselves: layouts read
// output fields by name (`{{ ["Term"] }}`, and renaming a field rewrites its
// references), and `ctx` carries the selected text and the target language
// next to the built-in `fields` and `status`. These ctx keys are part of every
// saved layout: add new ones, never rename or remove one.
export function createCustomActionLayoutHost(maxSourceLength = MAX_CUSTOM_ACTION_LAYOUT_LENGTH) {
  return defineLayoutHost({
    id: "extension.custom-action",
    ctxKeys: ["selection", "targetLanguage"],
    ctxKeyKinds: { selection: "string", targetLanguage: "string" },
    scopeKey: "name",
    maxSourceLength,
  })
}

export const CUSTOM_ACTION_LAYOUT_HOST = createCustomActionLayoutHost()

export interface CustomActionLayoutScopeInput {
  outputSchema: readonly SelectionToolbarCustomActionOutputField[]
  value: Readonly<Record<string, unknown>> | null
  selection: string
  targetLanguage: string
  status: LayoutStatus
}

// The data a custom action's layout renders: the (possibly partial) answer
// keyed by field name, plus ctx.
export function buildCustomActionLayoutScope({
  outputSchema,
  value,
  selection,
  targetLanguage,
  status,
}: CustomActionLayoutScopeInput): LayoutScope {
  return buildLayoutScope({
    host: CUSTOM_ACTION_LAYOUT_HOST,
    fields: outputSchema,
    values: value,
    ctx: { selection, targetLanguage },
    status,
  })
}
