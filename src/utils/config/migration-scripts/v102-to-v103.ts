/**
 * Migration script from v102 to v103.
 *
 * Gives every custom action a `layout` — the HTML + Liquid template its result
 * renders with in the selection popup — and removes the per-field `speaking`
 * flag, whose only job was to put a speak button next to a field in the old
 * field list. Which fields are read aloud is now written in the layout itself
 * (`data-speak`), so the flag is folded into the layout here:
 *
 * - An action with no speaking field gets the default field-list layout as it
 *   stood at v103 (name above value, no speak button).
 * - An action with speaking fields gets the same layout plus the v102 speak
 *   button on exactly those fields, matched by field id — an id survives a
 *   rename, a name would not:
 *     {%- assign rf_speak = "id-a|id-b" | split: "|" -%}
 *     … {%- if rf_speak contains f.id %}<button …>{%- endif %}
 *   (Liquid has no array literals; `contains` on the split array is an exact
 *   match. Should an id contain the separator, the ids are compared one by
 *   one instead.) Either way the result looks exactly as it did before.
 * - Unless that layout would outgrow the schema's cap on a layout: v102 bounds
 *   neither how many fields an action has nor how long their ids are, and a
 *   config the schema refuses is replaced by the defaults, losing everything
 *   in it. Such an action gets the plain layout instead, without its speak
 *   buttons (it takes hundreds of speaking fields to get there).
 *
 * The template walks `ctx.fields` and never names a field, so it keeps working
 * however the action's fields are renamed, reordered, added or removed; a
 * field added later simply has no speak button until the layout gives it one.
 *
 * The CONFIG_SCHEMA_VERSION bump that comes with this is what matters for
 * sync: an older build refuses a v103 config instead of quietly dropping every
 * `layout` and uploading the result.
 *
 * Only `selectionToolbar.customActions` is touched. The built-in Dictionary
 * persists nothing but its enabled/provider/Notebase state (its fields and card
 * are generated at read time), so `builtInActions` stays as it is.
 *
 * Known trade-off: the copy written here is frozen into the user's config, so a
 * later improvement to the default layout does not reach these actions on its
 * own; "Reset to default" in the editor fetches the current one.
 *
 * An action whose `layout` is already a string keeps it, blank included (blank
 * already means "the default"); only its `speaking` flags are dropped. Anything
 * else in that slot — absent, `null`, a stray non-string — is replaced. Entries
 * that are not objects, fields that are not objects, and a `customActions` or
 * `outputSchema` that is not an array, are left for the schema parse that
 * follows to report.
 *
 * Idempotent: a second run finds every action carrying a string layout and no
 * `speaking` flag, and returns the config by identity, as it does whenever
 * there is nothing to change.
 *
 * IMPORTANT: This is a frozen snapshot. All values and helpers are deliberately
 * inline and it imports nothing from the evolving application code — the
 * markup below is a verbatim copy of the default layout and the speak
 * button as they stood when v103 shipped, not a reference to them.
 */

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

// Frozen copies of DEFAULT_LAYOUT, LAYOUT_SPEAK_BUTTON_CSS and SPEAK_BUTTON_ICONS
// from @read-frog/layout-engine/presets at v103. Icons: Tabler Icons, MIT
// License, Copyright (c) 2020-2026 Paweł Kuna — https://github.com/tabler/tabler-icons
const SPEAK_BUTTON_CSS = `@keyframes rf-spin{to{transform:rotate(360deg)}}
.rf-speak{box-sizing:border-box;display:inline-flex;flex:none;align-items:center;justify-content:center;width:24px;height:24px;margin:0;padding:0;border:1px solid transparent;border-radius:min(calc(var(--rf-radius, 10px) - 2px), 10px);background:transparent;background-clip:padding-box;color:var(--rf-muted-foreground);font:inherit;outline:none;user-select:none;transition:all 150ms cubic-bezier(0.4, 0, 0.2, 1)}
.rf-speak:hover{background-color:var(--rf-secondary)}
:host([data-theme=dark]) .rf-speak:hover{background-color:color-mix(in oklab, var(--rf-secondary) 50%, transparent)}
.rf-speak:focus-visible{border-color:var(--rf-ring);box-shadow:0 0 0 3px color-mix(in oklab, var(--rf-ring) 50%, transparent)}
.rf-speak:active{transform:translateY(1px)}
.rf-speak[aria-disabled=true]{opacity:0.5;pointer-events:none}
.rf-speak svg{flex:none;width:12px;height:12px;pointer-events:none}
.rf-speak .rf-i-load,.rf-speak .rf-i-stop,.rf-speak[data-speak-state=loading] .rf-i-vol,.rf-speak[data-speak-state=playing] .rf-i-vol{display:none}
.rf-speak[data-speak-state=loading] .rf-i-load{display:block;animation:rf-spin 1s linear infinite}
.rf-speak[data-speak-state=playing] .rf-i-stop{display:block}`

const FIELD_ROW_CSS = `.rf-head{display:flex;align-items:center;gap:2px;height:24px}
.rf-label{display:inline-flex;align-items:center;gap:2px;min-width:0;font-size:12px;line-height:16px;font-weight:500;color:var(--rf-muted-foreground)}
.rf-label svg{flex:none;width:12px;height:12px}
.rf-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rf-value{font-size:14px;line-height:20px;white-space:pre-wrap;overflow-wrap:anywhere}`

const TYPE_ICON = `{%- if f.type == "number" -%}<svg class="rf-i-hash" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9l14 0"/><path d="M5 15l14 0"/><path d="M11 4l-4 16"/><path d="M17 4l-4 16"/></svg>{%- else -%}<svg class="rf-i-type" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l3 0"/><path d="M14 20l7 0"/><path d="M6.9 15l6.9 0"/><path d="M10.2 6.3l5.8 13.7"/><path d="M5 20l6 -16l2 0l7 16"/></svg>{%- endif -%}`

const SPEAK_BUTTON = `<button type="button" class="rf-speak" data-speak="{{ f.value }}"{% if f.value == blank %} aria-disabled="true"{% endif %}><svg class="rf-i-vol" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 8a5 5 0 0 1 0 8"/><path d="M17.7 5a9 9 0 0 1 0 14"/><path d="M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5"/></svg><svg class="rf-i-load" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9"/></svg><svg class="rf-i-stop" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="none" aria-hidden="true"><path d="M17 4h-10a3 3 0 0 0 -3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3 -3v-10a3 3 0 0 0 -3 -3z"/></svg></button>`

// A double-quoted Liquid string literal. `%` is written as a `\u` escape
// because liquidjs ends a `{% … %}` tag at the first `%}`, even inside quotes.
function liquidString(text: string): string {
  const escaped = text
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll("%", "\\u0025")
  return `"${escaped}"`
}

function buildLayout(speakIds: string[]): string {
  let speakAssign = ""
  let speakButton = ""
  if (speakIds.length > 0) {
    let isSpoken: string
    if (speakIds.every((id) => !id.includes("|"))) {
      speakAssign = `{%- assign rf_speak = ${liquidString(speakIds.join("|"))} | split: "|" -%}\n`
      isSpoken = "rf_speak contains f.id"
    } else {
      isSpoken = speakIds.map((id) => `f.id == ${liquidString(id)}`).join(" or ")
    }
    speakButton = `
      {%- if ${isSpoken} %}
      ${SPEAK_BUTTON}
      {%- endif %}`
  }

  return `<style>
${speakIds.length > 0 ? `${SPEAK_BUTTON_CSS}\n` : ""}${FIELD_ROW_CSS}
.rf-fields{display:flex;flex-direction:column;gap:12px}
</style>
${speakAssign}<div class="rf-fields">
  {%- for f in ctx.fields %}
  <section class="rf-field" data-rf-key="{{ f.id }}">
    <div class="rf-head">
      <span class="rf-label">
        ${TYPE_ICON}
        <span class="rf-name">{{ f.name }}</span>
      </span>${speakButton}
    </div>
    <div class="rf-value">{% if f.pending %}…{% elsif f.value == blank %}—{% else %}{{ f.value }}{% endif %}</div>
  </section>
  {%- endfor %}
</div>
`
}

// The schema's cap on a layout (MAX_CUSTOM_ACTION_LAYOUT_LENGTH) at v103.
const MAX_LAYOUT_LENGTH = 32768

// The layout for an action whose `speakIds` fields were speaking, or the plain
// one when that would not fit the cap (see the header).
function fittingLayout(speakIds: string[]): string {
  const layout = buildLayout(speakIds)
  return layout.length <= MAX_LAYOUT_LENGTH ? layout : buildLayout([])
}

// The action with its fields' `speaking` flags removed, and the ids of the
// fields that had it set; the action itself when no field carries the flag.
function stripSpeaking(action: Record<string, any>): {
  action: Record<string, any>
  speakIds: string[]
} {
  const speakIds: string[] = []
  if (!Array.isArray(action.outputSchema)) {
    return { action, speakIds }
  }

  let changed = false
  const outputSchema = action.outputSchema.map((field: any) => {
    if (!isObject(field) || !Object.hasOwn(field, "speaking")) {
      return field
    }
    changed = true
    const { speaking, ...rest } = field
    if (speaking === true && typeof field.id === "string" && !speakIds.includes(field.id)) {
      speakIds.push(field.id)
    }
    return rest
  })

  return { action: changed ? { ...action, outputSchema } : action, speakIds }
}

export function migrate(oldConfig: any): any {
  if (!isObject(oldConfig)) {
    return oldConfig
  }

  const selectionToolbar = oldConfig.selectionToolbar
  if (!isObject(selectionToolbar) || !Array.isArray(selectionToolbar.customActions)) {
    return oldConfig
  }

  let changed = false
  const customActions = selectionToolbar.customActions.map((original: any) => {
    if (!isObject(original)) {
      return original
    }
    const { action, speakIds } = stripSpeaking(original)
    if (typeof action.layout === "string") {
      if (action !== original) changed = true
      return action
    }
    changed = true
    return { ...action, layout: fittingLayout(speakIds) }
  })

  if (!changed) {
    return oldConfig
  }

  return {
    ...oldConfig,
    selectionToolbar: {
      ...selectionToolbar,
      customActions,
    },
  }
}
