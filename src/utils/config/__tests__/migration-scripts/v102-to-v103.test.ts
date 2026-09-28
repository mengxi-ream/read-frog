import {
  compileLayout,
  getCompiledLayoutCss,
  renderLayoutHtml,
} from "@read-frog/layout-engine/core"
import { lintLayout } from "@read-frog/layout-engine/editor"
import { DEFAULT_LAYOUT } from "@read-frog/layout-engine/presets"
import { describe, expect, it } from "vitest"
import { MAX_CUSTOM_ACTION_LAYOUT_LENGTH } from "@/types/config/selection-toolbar"
import { buildCustomActionLayoutScope, CUSTOM_ACTION_LAYOUT_HOST } from "@/utils/layout-host/host"
import { migrate } from "../../migration-scripts/v102-to-v103"

/** A stored v102 output field: carries `speaking`. Typed `any` like the
 * migration it feeds — this is a stored shape, not the current schema. */
function storedField(id: string, speaking: boolean): any {
  return { id, name: `Field ${id}`, type: "string", description: "", speaking }
}

/** A stored v102 custom action: no `layout`. */
function storedAction(id: string, overrides: Record<string, any> = {}): any {
  return {
    id,
    name: `Action ${id}`,
    enabled: true,
    icon: "tabler:sparkles",
    providerId: "openai-default",
    systemPrompt: "",
    prompt: "{{selection}}",
    outputSchema: [storedField(`${id}-field`, false)],
    ...overrides,
  }
}

function configWithActions(customActions: any): any {
  return {
    uiLanguage: "zh-CN",
    selectionToolbar: {
      enabled: true,
      opacity: 100,
      customActions,
      builtInActions: {
        dictionary: { enabled: false, providerId: "read-frog-free-ai" },
      },
    },
  }
}

function migrateOne(action: any): any {
  return migrate(configWithActions([action])).selectionToolbar.customActions[0]
}

// The layout the migration writes for an action without speaking fields, read
// back through the migration itself so the tests below do not depend on
// today's DEFAULT_LAYOUT.
function frozenLayout(): string {
  return migrateOne(storedAction("probe")).layout
}

// Renders a migrated action's layout against its own (migrated) fields and
// returns, per field id, whether its row has a speak button and what it reads.
function speakButtons(action: any): Record<string, string | null> {
  const compiled = compileLayout(action.layout)
  if (!compiled.ok) throw compiled.error
  const value = Object.fromEntries(
    action.outputSchema.map((field: any) => [field.name, `value of ${field.id}`]),
  )
  const html = renderLayoutHtml(
    compiled.compiled,
    buildCustomActionLayoutScope({
      outputSchema: action.outputSchema,
      value,
      selection: "s",
      targetCode: "eng",
      status: "done",
    }),
  )
  const result: Record<string, string | null> = {}
  for (const match of html.matchAll(
    /<section class="rf-field" data-rf-key="([^"]*)">([\s\S]*?)<\/section>/g,
  )) {
    const button = match[2]?.match(/<button [^>]*data-speak="([^"]*)"/)
    result[match[1] ?? ""] = button?.[1] ?? null
  }
  return result
}

describe("v102 to v103 migration", () => {
  it("gives an action without speaking fields the default layout", () => {
    const migrated = migrate(configWithActions([storedAction("a"), storedAction("b")]))

    for (const action of migrated.selectionToolbar.customActions) {
      expect(action.layout).toBe(frozenLayout())
    }
    expect(frozenLayout()).not.toContain("rf-speak")
  })

  it("writes a layout that walks ctx.fields, lints clean and fits the schema cap", () => {
    const plain = frozenLayout()
    const speaking = migrateOne(
      storedAction("s", { outputSchema: [storedField("a", true), storedField("b", false)] }),
    ).layout

    for (const layout of [plain, speaking]) {
      expect(layout).toContain("{%- for f in ctx.fields %}")
      expect(layout.length).toBeLessThanOrEqual(MAX_CUSTOM_ACTION_LAYOUT_LENGTH)
      const diagnostics = lintLayout(layout, CUSTOM_ACTION_LAYOUT_HOST, [
        { id: "a", name: "Field a", type: "string" },
        { id: "b", name: "Field b", type: "string" },
      ])
      expect(diagnostics.filter((diagnostic) => diagnostic.severity !== "info")).toEqual([])
    }
  })

  // A layout past the cap fails the schema, which would reset the whole config.
  it("gives the plain layout to an action whose speak list would outgrow the cap", () => {
    const outputSchema = Array.from({ length: 1000 }, (_, index) =>
      storedField(`speaking-${String(index).padStart(4, "0")}-${"x".repeat(30)}`, true),
    )
    const action = migrateOne(storedAction("many", { outputSchema }))

    expect(action.layout).toBe(frozenLayout())
    expect(action.layout.length).toBeLessThanOrEqual(MAX_CUSTOM_ACTION_LAYOUT_LENGTH)
    expect(action.outputSchema.some((field: any) => "speaking" in field)).toBe(false)
  })

  it("keeps a speak button on exactly the fields that were speaking", () => {
    const action = migrateOne(
      storedAction("s", {
        outputSchema: [
          storedField("spoken-1", true),
          storedField("silent", false),
          storedField("spoken-2", true),
        ],
      }),
    )

    expect(action.layout).toContain('{%- assign rf_speak = "spoken-1|spoken-2" | split: "|" -%}')
    expect(speakButtons(action)).toEqual({
      "spoken-1": "value of spoken-1",
      silent: null,
      "spoken-2": "value of spoken-2",
    })
  })

  it("disables the speak button while there is nothing to read", () => {
    const action = migrateOne(
      storedAction("s", {
        outputSchema: [
          storedField("pending", true),
          storedField("blank", true),
          { ...storedField("zero", true), type: "number" },
        ],
      }),
    )
    const compiled = compileLayout(action.layout)
    if (!compiled.ok) throw compiled.error
    const html = renderLayoutHtml(
      compiled.compiled,
      buildCustomActionLayoutScope({
        outputSchema: action.outputSchema,
        value: { "Field blank": " ", "Field zero": 0 },
        selection: "s",
        targetCode: "eng",
        status: "streaming",
      }),
    )
    const buttons = [...html.matchAll(/<button [^>]*>/g)].map((match) => match[0])

    expect(buttons).toEqual([
      '<button type="button" class="rf-speak" data-speak="" aria-disabled="true">',
      '<button type="button" class="rf-speak" data-speak="" aria-disabled="true">',
      '<button type="button" class="rf-speak" data-speak="0">',
    ])
  })

  it("matches ids exactly, not by substring", () => {
    const action = migrateOne(
      storedAction("s", {
        outputSchema: [storedField("context", true), storedField("context-translation", false)],
      }),
    )

    expect(speakButtons(action)).toEqual({
      context: "value of context",
      "context-translation": null,
    })
  })

  it("compares ids one by one when one contains the separator", () => {
    const action = migrateOne(
      storedAction("s", {
        outputSchema: [storedField("a|b", true), storedField("a", false), storedField("b", false)],
      }),
    )

    expect(action.layout).not.toContain("rf_speak")
    expect(speakButtons(action)).toEqual({ "a|b": "value of a|b", a: null, b: null })
  })

  it("escapes ids that Liquid would otherwise misread", () => {
    const tricky = ['q"uote', "back\\slash", "50%}", "new\nline"]
    const action = migrateOne(
      storedAction("s", { outputSchema: tricky.map((id) => storedField(id, true)) }),
    )

    expect(compileLayout(action.layout).ok).toBe(true)
    expect(Object.values(speakButtons(action)).every((text) => text !== null)).toBe(true)
  })

  it("drops `speaking` from every field and leaves everything else untouched", () => {
    const before = storedAction("a", {
      outputSchema: [storedField("x", true), storedField("y", false)],
    })
    const migrated = migrate(configWithActions([before]))
    const action = migrated.selectionToolbar.customActions[0]

    expect(action.outputSchema).toEqual([
      { id: "x", name: "Field x", type: "string", description: "" },
      { id: "y", name: "Field y", type: "string", description: "" },
    ])
    const { outputSchema: _before, ...restBefore } = before
    const { outputSchema: _after, layout: _layout, ...restAfter } = action
    expect(restAfter).toEqual(restBefore)
    expect(migrated.uiLanguage).toBe("zh-CN")
    expect(migrated.selectionToolbar.opacity).toBe(100)
  })

  it("leaves the built-in Dictionary alone", () => {
    const before = configWithActions([storedAction("a")])
    const migrated = migrate(before)

    expect(migrated.selectionToolbar.builtInActions).toBe(before.selectionToolbar.builtInActions)
    expect(migrated.selectionToolbar.builtInActions.dictionary).not.toHaveProperty("layout")
  })

  it("keeps a layout that is already a string, blank included, and still drops `speaking`", () => {
    const custom = storedAction("custom", { layout: "<p>{{ Result }}</p>" })
    const blank = storedAction("blank", { layout: "" })
    const migrated = migrate(configWithActions([custom, blank, storedAction("missing")]))
    const [customAfter, blankAfter, missingAfter] = migrated.selectionToolbar.customActions

    expect(customAfter.layout).toBe("<p>{{ Result }}</p>")
    expect(blankAfter.layout).toBe("")
    expect(missingAfter.layout).toBe(frozenLayout())
    for (const action of [customAfter, blankAfter, missingAfter]) {
      expect(action.outputSchema[0]).not.toHaveProperty("speaking")
    }
  })

  it("overwrites a foreign non-string layout", () => {
    for (const layout of [null, 42, { html: "<p></p>" }]) {
      expect(migrateOne(storedAction("a", { layout })).layout).toBe(frozenLayout())
    }
  })

  it("is idempotent", () => {
    const once = migrate(
      configWithActions([
        storedAction("a", { outputSchema: [storedField("x", true)] }),
        storedAction("b"),
      ]),
    )

    expect(migrate(once)).toBe(once)
  })

  it("returns a config with nothing to change by identity", () => {
    const empty = configWithActions([])
    expect(migrate(empty)).toBe(empty)

    const settled = configWithActions([
      storedAction("a", {
        layout: "<p></p>",
        outputSchema: [{ id: "x", name: "X", type: "string", description: "" }],
      }),
    ])
    expect(migrate(settled)).toBe(settled)
  })

  it("skips actions and fields that are not objects, and a non-array outputSchema", () => {
    const migrated = migrate(
      configWithActions([
        null,
        "nope",
        storedAction("fields", { outputSchema: [null, "nope", storedField("x", true)] }),
        storedAction("schema", { outputSchema: { x: storedField("x", true) } }),
      ]),
    )
    const [nullAction, stringAction, fields, schema] = migrated.selectionToolbar.customActions

    expect([nullAction, stringAction]).toEqual([null, "nope"])
    expect(fields.outputSchema).toEqual([
      null,
      "nope",
      { id: "x", name: "Field x", type: "string", description: "" },
    ])
    expect(speakButtons({ ...fields, outputSchema: [fields.outputSchema[2]] })).toEqual({
      x: "value of x",
    })
    expect(schema.outputSchema).toEqual({ x: storedField("x", true) })
    expect(schema.layout).toBe(frozenLayout())
  })

  it("returns configs it cannot place the field in untouched", () => {
    for (const config of [
      null,
      undefined,
      "nope",
      {},
      { selectionToolbar: null },
      { selectionToolbar: {} },
      configWithActions({ a: storedAction("a") }),
    ]) {
      expect(migrate(config)).toBe(config)
    }
  })

  // Holds only while DEFAULT_LAYOUT is still the one v103 shipped:
  // it catches a copy that drifted while the two were written side by side. If
  // the constant changes later, DELETE this test — never "fix" it by editing the
  // migration's literal, which must keep what v103 actually wrote.
  it("freezes a verbatim copy of the default layout as first shipped", () => {
    expect(frozenLayout()).toBe(DEFAULT_LAYOUT)
  })
})

// Every user who had a custom action before layouts existed got one of these
// three layouts, verbatim, in their config. They must render as they did when
// v103 shipped whatever version of @read-frog/layout-engine this build pins: a
// change to these files is a change to what those users see, so review it
// before updating them (vitest -u).
describe("layouts written by the v102 to v103 migration", () => {
  // Names and values that try to break out of the markup: all of it must come
  // out escaped. `f|1` holds the separator, so its speak test is spelled out.
  const FIELDS: Array<[id: string, name: string, type: string]> = [
    ["f1", "Term", "string"],
    ["f2", "Count", "number"],
    ["f3", "Note", "string"],
    ["f|1", 'Evil "<b>name</b>', "string"],
  ]
  const VALUES = {
    Term: "blossom",
    Count: 3,
    Note: "line one\nline <two> & {{ not liquid }}",
    'Evil "<b>name</b>': "<img src=x onerror=alert(1)>",
  }
  const FRAMES: Array<
    [name: string, value: Record<string, unknown> | null, status: "streaming" | "done" | "error"]
  > = [
    ["nothing yet", null, "streaming"],
    ["half", { Term: "blos", Count: 3 }, "streaming"],
    ["done", VALUES, "done"],
    ["done, empty values", { Term: "", Count: 0, Note: null }, "done"],
    ["error", { Term: "blossom" }, "error"],
  ]

  it.each([
    ["no-speak", []],
    ["speak", ["f1", "f3"]],
    ["speak-or", ["f|1"]],
  ] as Array<[name: string, speaking: string[]]>)("%s renders the same", async (name, speaking) => {
    const action = migrateOne(
      storedAction("golden", {
        outputSchema: FIELDS.map(([id, fieldName, type]) => ({
          id,
          name: fieldName,
          type,
          description: "",
          speaking: speaking.includes(id),
        })),
      }),
    )
    const compiled = compileLayout(action.layout)
    if (!compiled.ok) throw compiled.error
    const parts = [`== css\n${getCompiledLayoutCss(compiled.compiled)}`]
    for (const [frame, value, status] of FRAMES) {
      const html = renderLayoutHtml(
        compiled.compiled,
        buildCustomActionLayoutScope({
          outputSchema: action.outputSchema,
          value,
          selection: "The selection",
          targetCode: "cmn",
          status,
        }),
      )
      parts.push(`== ${frame} (${status})\n${html}`)
    }
    await expect(`${parts.join("\n\n")}\n`).toMatchFileSnapshot(`./__renders__/v103-${name}.txt`)
  })
})
