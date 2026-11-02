/**
 * The passage a selection was taken from, for the prompt that translates it.
 *
 * A word means different things in different sentences. The selection
 * toolbar already collects the paragraph(s) around a selection
 * (`buildContextSnapshot`); this is how that text reaches the prompt. Only
 * the selection paths pass it: page translation translates whole paragraphs
 * and never sets it, so its prompts — and with them its cache keys — are
 * untouched.
 */

/**
 * The same cap as a custom action's `{{paragraphs}}`: enough for the
 * paragraph the word is in and its neighbours, not a page.
 */
export const SELECTION_CONTEXT_CHAR_LIMIT = 2000

export interface SelectionPromptContext {
  /** The paragraph(s) around the selection, already cut to the limit. */
  passage: string
}

const collapseWhitespace = (text: string) => text.replace(/\s+/g, " ").trim()
const WORD_CHARACTER = /[\p{L}\p{N}]/u

/**
 * The paragraphs a selection sits in, as prompt context, or `undefined` when
 * there is nothing to give: the prompt then comes out byte-identical to one
 * built without context. Nothing either when the passage holds no words
 * beyond the selected `input` (a whole paragraph selected), or does not hold
 * the input at all (a selection longer than the cut): the passage would only
 * repeat the input, and the rules would call the input a fragment of itself.
 */
export function toSelectionPromptContext(
  paragraphs: readonly string[] | null | undefined,
  input: string,
): SelectionPromptContext | undefined {
  const passage = (paragraphs ?? [])
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "")
    .join("\n\n")
    .slice(0, SELECTION_CONTEXT_CHAR_LIMIT)
    .trim()
  if (passage === "") return undefined
  const fragment = collapseWhitespace(input)
  const flatPassage = collapseWhitespace(passage)
  if (!flatPassage.includes(fragment)) return undefined
  return WORD_CHARACTER.test(flatPassage.replace(fragment, "")) ? { passage } : undefined
}

/**
 * Written in the shape of the glossary and marker blocks, so all of them read
 * as one family. Like them it carries no worked example (see
 * `utils/glossary/prompt.ts` for the measured reason).
 */
export const SELECTION_CONTEXT_SYSTEM_PROMPT_RULES = `## Passage Rules
These mandatory rules override any conflicting instructions above:
1. The input is a fragment taken from the Passage below. Use the Passage only to decide what the input means where it stands.
2. Translate only the input. The Passage is reference data and must never appear in your output, whole or in part.
3. When the input is a single word or a short phrase, render it with the sense it has in the Passage.`

/** The rules block plus the passage, or `null` when there is no passage. */
export function renderSelectionContextPromptBlock(
  context: SelectionPromptContext | undefined,
): string | null {
  if (!context || context.passage.trim() === "") return null

  return `${SELECTION_CONTEXT_SYSTEM_PROMPT_RULES}

Passage:
${context.passage}`
}

/**
 * Attach the passage block to a system prompt, after the glossary block and
 * joined the same way. Appended after token replacement: a passage is
 * arbitrary page text that may contain a \`{{input}}\`-shaped substring, and
 * must not get to rewrite the prompt around it.
 */
export function appendSelectionContextToSystemPrompt(
  systemPrompt: string,
  context: SelectionPromptContext | undefined,
): string {
  const block = renderSelectionContextPromptBlock(context)
  return block ? `${systemPrompt}\n\n${block}` : systemPrompt
}
