import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { SupportedUiLocale } from "@/utils/i18n/locales"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import {
  LAYOUT_ALLOWED_TAGS,
  LAYOUT_ANNOTATE_MAX_ITEMS,
  LAYOUT_ANNOTATE_MAX_TEXT_LENGTH,
  LAYOUT_DEFAULT_RENDER_BUDGET,
  LAYOUT_FILTER_NAMES,
  LAYOUT_MAX_ELEMENTS,
  LAYOUT_MAX_RENDERED_LENGTH,
  LAYOUT_PARSE_JSON_MAX_LENGTH,
  LAYOUT_RESERVED_FIELD_NAMES,
  LAYOUT_THEME_TOKENS,
} from "@read-frog/layout-engine/contract"
import { DEFAULT_LAYOUT } from "@read-frog/layout-engine/presets"
import {
  MAX_CUSTOM_ACTION_LAYOUT_LENGTH,
  selectionToolbarCustomActionOutputTypeSchema,
} from "@/types/config/selection-toolbar"
import {
  getSelectionToolbarCustomActionTokenCellText,
  SELECTION_TOOLBAR_CUSTOM_ACTION_TOKENS,
} from "@/utils/constants/custom-action"
import { i18n, translateIn } from "@/utils/i18n"
import { langCodeOfLocale } from "@/utils/layout-host/labels"
import { resolveActionLayout } from "@/utils/layout-host/resolve"

// The prompt behind "Configure with AI": the user pastes it into any chat
// assistant, which then asks what they want and hands back settings to copy
// into the editor. It carries everything the assistant cannot see: how an
// action runs, every setting and its rules, the layout language, and the
// action being edited. English on purpose, like the built-in prompts: the
// assistant talks to the user in their UI language.
//
// Holds no secrets: the provider and the Notebase account stay out.

// What Read Frog's built-in AI accepts (the api-contract's hosted structured
// object input). Bring-your-own providers take any size.
const HOSTED_LIMITS = {
  instructions: 16_000,
  prompt: 32_000,
  fields: 32,
  fieldName: 80,
}

// The popup's default and minimum widths (use-selection-popover-layout.ts).
const POPUP_WIDTH = { default: 500, min: 320 }

// A worked example for the layout reference: a JSON array in a string field,
// parsed, anchored onto the selection with `annotate`, and listed. Exported
// for the test that renders it, so it never shows the assistant a layout that
// does not work.
export const EXAMPLE_OUTPUT_FIELDS = [
  {
    name: "Phrases",
    type: "string",
    description:
      'A compact JSON array serialized as a string, one item per useful phrase in the selection: {"text": the phrase copied exactly from the selection, "meaning": its meaning in {{targetLanguage}}, at most 8 words}. Example: [{"text":"take off","meaning":"to leave the ground"}]',
  },
  {
    name: "Translation",
    type: "string",
    description: "A natural translation of the whole selection in {{targetLanguage}}.",
  },
] as const

export const EXAMPLE_LAYOUT = `<style>
:host{--hl:oklch(0.72 0.16 60)}
:host([data-theme=dark]){--hl:oklch(0.8 0.14 75)}
.source{margin:0;font-size:15px;line-height:1.7}
.phrase{border-bottom:2px solid var(--hl);cursor:help}
.list{display:flex;flex-direction:column;gap:4px;margin:10px 0 0;padding:0;list-style:none}
.list b{font-weight:600}
.translation{margin:10px 0 0;color:var(--rf-muted-foreground)}
</style>
{%- assign phrases = ["Phrases"] | parse_json -%}
{%- assign parts = ctx.selection | annotate: phrases -%}
<p class="source" data-rf-key="source">
  {%- for e in parts -%}
    {%- if e.kind == "enter" -%}<span class="phrase" data-tip="{{ e.item.meaning }}">
    {%- elsif e.kind == "leave" -%}</span>
    {%- else -%}{{ e.text }}{%- endif -%}
  {%- endfor -%}
</p>
{%- if phrases.size > 0 %}
<ul class="list" data-rf-key="list">
  {%- for p in phrases %}
  <li><b>{{ p.text }}</b> — {{ p.meaning }}</li>
  {%- endfor %}
</ul>
{%- endif %}
{%- if ["Translation"] %}
<p class="translation" data-rf-key="translation">{{ ["Translation"] | newline_to_br }}</p>
{%- elsif ctx.status == "streaming" %}
<p class="translation">…</p>
{%- endif %}
`

export interface AiConfigHelperPromptInput {
  // The action being edited, as the form holds it (unsaved edits included).
  action: SelectionToolbarCustomAction
  // Names the action's name must not repeat.
  otherActionNames: readonly string[]
  uiLocale: SupportedUiLocale
  targetCode: LangCodeISO6393
}

// Wraps `content` in a fence longer than any backtick run inside it, so a
// prompt or layout that holds its own fences stays in one block.
function fence(text: string, lang = "") {
  const content = text.replace(/\n+$/, "")
  const longestRun = Math.max(0, ...Array.from(content.matchAll(/`+/g), (match) => match[0].length))
  const ticks = "`".repeat(Math.max(3, longestRun + 1))
  return `${ticks}${lang}\n${content}\n${ticks}`
}

function quoteList(values: readonly string[]) {
  return values.map((value) => `\`${value}\``).join(", ")
}

const FORM = "options.selectionToolbar.customActions.form"
const TEMPLATES = "options.selectionToolbar.customActions.templates"

// UI labels the assistant names, keyed by the English wording it uses.
const UI_LABEL_KEYS = [
  "options.selectionToolbar.customActions.add",
  `${TEMPLATES}.blank.name`,
  `${TEMPLATES}.dictionary.name`,
  `${TEMPLATES}.sentenceAnalysis.name`,
  `${TEMPLATES}.improveWriting.name`,
  "options.selectionToolbar.customActions.tabs.config",
  "options.selectionToolbar.customActions.tabs.notebase",
  `${FORM}.name`,
  `${FORM}.icon`,
  `${FORM}.provider`,
  `${FORM}.systemPrompt`,
  `${FORM}.prompt`,
  `${FORM}.outputSchema`,
  `${FORM}.addField`,
  `${FORM}.fieldName`,
  `${FORM}.fieldType`,
  `${FORM}.fieldDescription`,
  `${FORM}.defaultFieldName`,
  `${FORM}.layout.title`,
  `${FORM}.layout.edit`,
  `${FORM}.layout.reset`,
] as const

type UiLabelKey = (typeof UI_LABEL_KEYS)[number]

function en(key: UiLabelKey) {
  return translateIn("en", key)
}

function buildUiLabelGlossary(uiLocale: SupportedUiLocale, uiLanguage: string) {
  if (uiLocale === "en") return ""
  const rows = UI_LABEL_KEYS.map((key) => `- ${en(key)} → ${i18n.t(key)}`)
  return `My Read Frog interface is in ${uiLanguage}, so the editor shows these labels instead of the English ones used below. Use the ones on the right when you tell me where to click or paste:
${rows.join("\n")}
`
}

function buildTokenList(targetLanguage: string) {
  return SELECTION_TOOLBAR_CUSTOM_ACTION_TOKENS.map((token) => {
    const description = translateIn("en", `${FORM}.tokens.${token}`)
    const current = token === "targetLanguage" ? ` (currently "${targetLanguage}")` : ""
    return `- \`${getSelectionToolbarCustomActionTokenCellText(token)}\`: ${description}${current}`
  }).join("\n")
}

function buildCurrentAction(
  action: SelectionToolbarCustomAction,
  otherActionNames: readonly string[],
) {
  const layout = resolveActionLayout(action)
  const layoutNote = layout === DEFAULT_LAYOUT ? " (the default field list)" : ""
  const fields = action.outputSchema
    .map((field, index) => {
      const description = field.description.trim()
        ? `\n${fence(field.description, "text")}`
        : " (no description)"
      return `${index + 1}. Name: \`${field.name}\` · Type: \`${field.type}\` · Description:${description}`
    })
    .join("\n")

  const fieldNameById = new Map(action.outputSchema.map((field) => [field.id, field.name]))
  const mappedFields = (action.notebaseConnection?.mappings ?? []).flatMap((mapping) => {
    const name = fieldNameById.get(mapping.localFieldId)
    return name === undefined ? [] : [`\`${name}\``]
  })
  const notebase =
    mappedFields.length > 0
      ? `\nThis action saves results to a Notebase, from these fields: ${mappedFields.join(", ")}. Deleting one of them, or changing its type, breaks that mapping and I'd have to map it again in the Notebase tab. Renaming is fine.`
      : ""

  const others =
    otherActionNames.length > 0
      ? `My other custom actions are named ${quoteList(otherActionNames)}; a new name must differ from these.`
      : "I have no other custom actions."

  return `## The action I have open

This is the action I was editing when I copied this prompt. If I want to change it, start from exactly this; if I want a new action, use it only as a reference.

**Name:** \`${action.name}\`
**Icon:** \`${action.icon}\`

**System prompt:**
${action.systemPrompt.trim() ? fence(action.systemPrompt, "text") : "(empty)"}

**Prompt:**
${action.prompt.trim() ? fence(action.prompt, "text") : "(empty)"}

**Output schema** (in order):
${fields}

**Layout**${layoutNote}:
${fence(layout, "html")}
${notebase}
${others}
`
}

export function buildAiConfigHelperPrompt({
  action,
  otherActionNames,
  uiLocale,
  targetCode,
}: AiConfigHelperPromptInput): string {
  const uiLanguage = LANG_CODE_TO_EN_NAME[langCodeOfLocale(uiLocale)]
  const targetLanguage = LANG_CODE_TO_EN_NAME[targetCode]
  const fieldTypes = quoteList(selectionToolbarCustomActionOutputTypeSchema.options)
  const reservedNames = quoteList(LAYOUT_RESERVED_FIELD_NAMES)
  // A label as the user's editor shows it, with the English one beside it.
  const label = (key: UiLabelKey) =>
    uiLocale === "en" ? `"${en(key)}"` : `"${i18n.t(key)}" (${en(key)})`
  const blank = label(`${TEMPLATES}.blank.name`)
  const addAction = label("options.selectionToolbar.customActions.add")
  const addField = label(`${FORM}.addField`)
  const defaultField = label(`${FORM}.defaultFieldName`)
  const edit = label(`${FORM}.layout.edit`)
  const reset = label(`${FORM}.layout.reset`)
  const templateNames = [
    label(`${TEMPLATES}.dictionary.name`),
    label(`${TEMPLATES}.sentenceAnalysis.name`),
    label(`${TEMPLATES}.improveWriting.name`),
  ].join(", ")

  return `# Help me set up a custom AI action in Read Frog

I use Read Frog (陪读蛙), a browser extension for reading and learning languages on the web. It lets me create **custom AI actions**: buttons that send the text I select on a page to an AI model and show a structured answer in a popup. I'd like your help configuring one. You can't see my extension, so you'll design the settings and I'll copy them in by hand. Everything you need is below: how actions work, every setting and its rules, the layout language, and the action I have open.

## How to work with me

1. **Ask first.** Before designing anything, find out what I want, in one short message with at most three questions, then wait for my answer:
   - Do I want to **change the action I have open** ("${action.name}", shown at the end) or **create a new action**?
   - What should it do? What will I usually select (a word, a sentence, a paragraph, code…), and what do I want back?
   - Only if it matters for the design: how the result should look (a compact card, a list, highlights on the selected text…), and which language the answer should be in.
   Skip questions my messages already answer. If I've only pasted this prompt, just ask.
2. **Plan briefly.** Unless the change is small, summarize your plan in a few lines (the output fields, and what the popup will show) and let me confirm or adjust.
3. **Hand me the settings**, as described in "How to hand me the settings".
4. **Iterate.** I'll try the action on a real page. If something is off, I'll describe it or paste what I see (the result, or a message from the layout editor). Fix only what needs fixing.

Talk to me in ${uiLanguage}, unless I write in another language.

${buildUiLabelGlossary(uiLocale, uiLanguage)}
## How a custom AI action runs

1. I select text on a web page and click the action's icon in Read Frog's selection toolbar.
2. Read Frog fills in the tokens (below) in the System prompt, the Prompt and every field description.
3. It sends the System prompt (as the system instructions) and the Prompt (as the user message) to the AI provider chosen for the action, asking for **structured output**: one JSON object whose keys are exactly the output fields.
4. The answer streams into a popup next to the selection (${POPUP_WIDTH.default}px wide by default, as narrow as ${POPUP_WIDTH.min}px), drawn by the action's Layout. Fields fill in as they arrive, in schema order.

Read Frog appends an output contract to the end of the System prompt by itself. It lists every field (key, type, description, nullable) and tells the model to return one bare JSON object with exactly those keys, no markdown or code fences, \`null\` for unknown values, and numbers as JSON numbers. So:
- don't repeat JSON formatting rules in the System prompt, and never ask for markdown or code fences;
- do say precisely what each field holds in its **Description**: it is the model's main guide for that field.

Values are shown as plain text: markdown is not rendered, and HTML in a value is escaped. Line breaks show only where the layout keeps them (see \`newline_to_br\`).

## Tokens

Write these exactly as shown (double braces, no spaces) in the System prompt, the Prompt or a field Description. Each is replaced with plain text before the request. There are no other tokens: anything else in double braces reaches the model as written. There are no conditions or loops in prompts either (Liquid exists only in the Layout).
${buildTokenList(targetLanguage)}

## The settings

The editor has two tabs: Config (every setting below, in this order) and Notebase.

### Name
The tooltip of the action's button in the selection toolbar. Required, and unique among my custom actions.

### Icon
An Iconify icon id, \`prefix:name\`, e.g. \`tabler:bulb\`, \`tabler:language\`, \`tabler:school\`. Any icon from https://icon-sets.iconify.design works; prefer the Tabler set (\`tabler:\`), and only suggest ids you're confident exist.

### Provider
Which AI model runs the action: Read Frog's built-in AI, or one of the providers I've set up with my own API key. The model must support structured output. I pick it myself; if the task needs a strong model (careful reasoning, long JSON inside a string), tell me.
With Read Frog's built-in AI: the Prompt must not be empty, the System prompt must stay under ${HOSTED_LIMITS.instructions.toLocaleString("en")} characters once the tokens are filled in and the output contract is appended, the filled-in Prompt under ${HOSTED_LIMITS.prompt.toLocaleString("en")}, and there can be at most ${HOSTED_LIMITS.fields} output fields with names of at most ${HOSTED_LIMITS.fieldName} characters.

### System prompt
The model's instructions: its role, the goal, rules, and one or two short examples, which help a lot with consistent output. Tokens are allowed. Good practice:
- English instructions are usually the most reliable, whatever language the answer is in. Say which language each field is written in (usually \`{{targetLanguage}}\`).
- Say what to do with each kind of selection the action may get (a single word, a phrase, a whole paragraph, text in an unexpected language).
- Ask for an empty value instead of a guess when a field doesn't apply.

### Prompt
The user message, usually just the inputs. Keep it non-empty, e.g.:
${fence("## Input\nSelection: {{selection}}\nParagraphs: {{paragraphs}}\nTarget language: {{targetLanguage}}", "text")}

### Output schema
The fields of the JSON object the model returns, in order. At least one. Each has:
- **Field name**: the JSON key, and the label the default layout shows above the value, so name it in the language I read. Unique within the action. ${reservedNames} are reserved in layouts; don't use them.
- **Field type**: ${fieldTypes}. There is no boolean, array or object type. For a list or anything structured, use a \`string\` field whose description asks for **a compact JSON array serialized as a string**, spells out each item's keys, and gives a one-line example; the layout parses it with \`parse_json\`. For yes/no or a category, use a \`string\` with fixed values listed in the description. A \`number\` field reaches the layout as a real number.
- **Description**: exactly what goes in the field, and in which language. Tokens are allowed.
Fields stream in this order, so put what I want to read first at the top. Fewer fields make faster, more reliable answers; aim for no more than about eight. Any value may come back empty.
In the editor, ${addField} adds a field, clicking a field edits it, and each field can be deleted. Renaming a field there also updates the layout's references to it.

### Layout
How the result looks in the popup: HTML with Liquid, described in "Layout reference". ${edit} opens a code editor with a live preview on sample data (and lint messages); ${reset} replaces the layout with the default field list (or, when the fields fit, a Dictionary or Sentence analysis card). An empty layout shows the default field list: each field's name above its value. The default is often enough; write a layout when it clearly helps, e.g. a headword card, highlights on the selected text, a list or table, badges.

### Notebase tab
Optionally saves every result as a row in one of my Notebases (Read Frog's online notes and flashcards; needs a readfrog.app account). I choose the Notebase and map output fields to its columns myself; you can't set that up. If I want to save results, plan one field per column, with \`number\` fields for number columns.

## Layout reference

A layout is HTML with Liquid (the liquidjs flavor of Shopify's template language), plus optional \`<style>\` blocks. It renders inside an isolated shadow root and re-renders on every streamed chunk.

### Data
- A field's value: \`{{ ["Field name"] }}\`. This bracket form works for any name, including spaces and non-Latin scripts; a plain ASCII name also works bare (\`{{ Word }}\`). A value is a string, a number for \`number\` fields, or nil while it is empty or hasn't arrived.
- Show something only when a field has a value: \`{% if ["Field name"] %}…{% endif %}\`.
- \`ctx.fields\`: every field in schema order, each with \`id\`, \`name\`, \`type\`, \`value\` and \`pending\` (true while streaming, before the model has started that field).
- \`ctx.selection\`: the selected text. \`ctx.targetLanguage\`: the target language's English name. \`ctx.status\`: \`"streaming"\`, \`"done"\` or \`"error"\`.
- \`ctx.sentenceAnalysisLabels\` is only for the built-in Sentence analysis card; ignore it.
- \`{% assign name = … %}\` makes a local; never give a local a field's name, it would hide the field.

### Liquid
- Tags: ${quoteList(LAYOUT_ALLOWED_TAGS.filter((tag) => tag !== "#"))} and \`{% # comment %}\`. Nothing else: no \`include\`, \`render\`, \`capture\`, \`echo\` or \`cycle\`.
- Filters: ${quoteList(LAYOUT_FILTER_NAMES)}.
- Every output is HTML-escaped (\`raw\` and \`escape\` change nothing), so a value can never inject markup. Always quote attributes that contain output: \`title="{{ … }}"\`.
- Filters written in a \`for\` or \`when\` tag are ignored: assign the filtered value first, then loop over the local.
- \`parse_json\`: JSON text → data (nil when it isn't JSON; text over ${LAYOUT_PARSE_JSON_MAX_LENGTH.toLocaleString("en")} characters gives nil). For a JSON array cut off mid-stream it returns the items completed so far, so a list grows item by item while the answer streams.
- \`newline_to_br\`: keeps a value's line breaks. It must be the last filter of an output.
- \`lines\`: splits text into trimmed, non-empty lines for a \`for\` loop.
- \`annotate\`: \`{% assign parts = text | annotate: items %}\` finds, in \`text\`, the span each item quotes in its \`"text"\` key (or in the key named by a second argument), and returns events covering the whole text in order: \`{kind: "text", text}\` for plain stretches, and \`{kind: "enter"}\` / \`{kind: "leave"}\` around each found span, carrying \`item\` (the item itself), \`index\`, \`depth\` and \`leaf\`. One flat \`for\` loop over the events draws the text with the spans marked (see the example). Matching ignores case, whitespace runs and typographic quotes and dashes; \`"occurrence": n\` in an item picks the nth match; "…" inside a quote stands for skipped words ("turned … down"). Spans may nest but not partly overlap; items that don't match are dropped. At most ${LAYOUT_ANNOTATE_MAX_ITEMS} items, and no marks in text over ${LAYOUT_ANNOTATE_MAX_TEXT_LENGTH.toLocaleString("en")} characters. For this to work, the field's description must tell the model to copy each quote character for character from the text.

### HTML
- Allowed: common text, heading, list and table elements (\`div\`, \`span\`, \`p\`, \`b\`, \`strong\`, \`em\`, \`mark\`, \`code\`, \`blockquote\`, \`ul\`, \`li\`, \`dl\`, \`table\`, \`h1\`–\`h6\`, \`section\`, \`ruby\`/\`rt\`, …), \`details\`/\`summary\`, \`button\`, \`a\`, \`img\`, and basic SVG (\`svg\`, \`path\`, \`circle\`, \`rect\`, \`line\`, gradients). Attributes: \`class\`, \`style\`, \`title\`, \`lang\`, \`dir\`, \`role\`, \`hidden\`, \`open\`, \`colspan\`/\`rowspan\`, sizes, SVG presentation attributes, and any \`data-*\` or \`aria-*\`.
- Removed: scripts and event handlers (\`onclick\`…), forms and inputs, iframes, \`id\`s, and anything that loads a resource. \`<a href>\` must be http(s) (it opens in a new tab); \`<img src>\` must be a \`data:image/…\` URI.
- There is no JavaScript. Interactivity comes from \`<details>\`, CSS (\`:hover\`) and the attributes below.
- Whitespace between tags is text. Under \`white-space: pre-wrap\` every line break and indent in the markup shows up in the result, so trim it with \`{%-\` / \`-%}\` or keep that markup on one line, and put \`pre-wrap\` only on an element that holds a value directly.

### CSS
- Put CSS in \`<style>\` blocks (they always apply wherever they sit; Liquid doesn't run inside them) or in \`style\` attributes. It applies only inside this result.
- No \`@import\`, no \`@font-face\`, no \`url()\` other than \`data:\` URIs. The font is the system UI font at 14px/1.5; use px sizes.
- Theme variables, which follow light and dark mode: ${quoteList(LAYOUT_THEME_TOKENS.map((token) => `var(--rf-${token})`))}. All but one are neutral grays: \`--rf-popover\` is the popup's background, \`--rf-popover-foreground\` the main text, \`--rf-muted-foreground\` secondary text and labels, \`--rf-border\` lines and dividers, \`--rf-ring\` a mid gray for emphasis lines and focus outlines, and \`--rf-radius\` the corner radius. \`--rf-muted\` and \`--rf-secondary\` are one very light fill, only for box backgrounds and hover states: as a text, border or highlight color they are nearly invisible. \`--rf-accent\` is Read Frog's blue, for the one thing that should stand out; white text reads on it.
- For real color (highlights, badges, categories), define your own variable for both themes and use it, as the example does: \`:host{--hl:oklch(0.72 0.16 60)} :host([data-theme=dark]){--hl:oklch(0.8 0.14 75)}\`. Translucent fills (\`color-mix(in oklab, var(--hl) 20%, transparent)\`) work on both backgrounds.
- An invalid declaration is dropped without a warning, so only use real CSS (a wavy line is \`text-decoration: underline wavy\`; borders can't be wavy).
- The host element carries \`data-status\` (\`streaming\` | \`done\` | \`error\`) and \`data-theme\` (\`light\` | \`dark\`): \`:host([data-status=streaming]) .skeleton{…}\`, \`:host([data-theme=dark]) .badge{…}\`.

### Built-in interactions (no JavaScript needed)
- **Speak**: clicking an element with \`data-speak="text"\` reads the text aloud (an empty value reads the element's own text), once the answer is done. E.g. \`<button type="button" data-speak="{{ ["Word"] }}" aria-label="Speak">🔊</button>\`.
- **Tips**: an element with \`data-tip="text"\` shows a bubble while hovered, focused or tapped. For rich content, put a hidden child \`<span data-tip-body>…</span>\` in it instead of the value. With \`data-tip-link="k"\` on it and \`data-tip-key="k"\` on other elements, arrows point from it to them while its tip shows; \`:host([data-tip-active])\` and \`[data-tip-state=active]\` / \`[data-tip-state=linked]\` let CSS dim everything else.
- **Toggles**: pressing an element with \`data-toggle="name"\` switches \`name\` on and off in the host's \`data-toggles\`; style with \`:host([data-toggles~=name]) .more{display:block}\`. The toggle gets \`aria-pressed\`.
- \`data-rf-key="unique-key"\` on larger blocks keeps them steady across streaming re-renders. Keys must be unique.

### Streaming, errors and limits
- The layout renders many times while the answer streams: fields arrive in schema order and strings grow. Guard every field with \`{% if %}\`, show a placeholder or skeleton for what hasn't arrived (\`f.pending\`, \`ctx.status\`, \`:host([data-status=streaming])\`), and never assume a later field exists yet.
- The layout source can be at most ${MAX_CUSTOM_ACTION_LAYOUT_LENGTH.toLocaleString("en")} characters; the rendered HTML at most ${LAYOUT_MAX_RENDERED_LENGTH.toLocaleString("en")} characters and ${LAYOUT_MAX_ELEMENTS.toLocaleString("en")} elements, and a render must finish within ${LAYOUT_DEFAULT_RENDER_BUDGET.renderLimitMs}ms. A layout with a syntax error, or one that breaks a limit, falls back to the default field list, and the layout editor shows why.
- Every field should appear in the layout unless it exists only for the Notebase; the editor lists fields a layout leaves out.

### Example
Output fields:
${EXAMPLE_OUTPUT_FIELDS.map((field) => `- \`${field.name}\` (\`${field.type}\`): ${field.description}`).join("\n")}

Layout: the selection with each phrase underlined (hover shows its meaning), then the list of phrases, then the translation.
${fence(EXAMPLE_LAYOUT, "html")}

## How to hand me the settings

I copy each setting into the editor by hand, so:
- When you tell me where to click or what to rename, use the labels exactly as my editor shows them. Everything saves automatically as I edit; there is no Save button.
- Give each setting under its own heading, named as my editor shows it, in the editor's order: Name, Icon, System prompt, Prompt, Output schema, Layout. Put every value I paste in its own code block, holding the complete value, ready to paste as is: never a diff or "… rest unchanged".
- When changing the action I have open, give only the settings that change, and tell me which stay as they are.
- **Output schema**: list the fields in order, each with its name, its type and its description (the description in its own code block). Then compare them with the fields the action has now and say exactly what to do in the editor: which fields to rename (from what to what), which to add, which to delete, and in which order they should end up. Output schema changes come before the layout, which refers to fields by name.
- **Layout**: the whole layout in one \`html\` code block, and tell me to click ${edit} under Layout, replace everything in the editor with it, and check the preview. If the default field list is enough, say so and leave the layout out.
- **New action**: tell me to click ${addAction} and pick ${blank} (or ${templateNames}, if one is a closer start), then fill in the settings. The ${blank} template starts with one field named ${defaultField}; tell me to rename or delete it.
- Don't invent features that aren't described here: actions can't call other actions, fetch web pages, remember earlier runs or run JavaScript.

${buildCurrentAction(action, otherActionNames)}`
}
