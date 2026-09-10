import type { MatchedTerm } from "./types"

/**
 * Written on the right-hand side of a term that must be reproduced unchanged.
 *
 * A literal marker rather than an empty right-hand side: an empty slot is
 * ambiguous and models fill ambiguity. It is also the one representation that
 * survives every transport — DeepL's API rejects an empty target and
 * Microsoft's dynamic dictionary needs `translation="<the source form>"` — so
 * the UI's "no translation given" and the wire's instruction stay separable.
 */
export const GLOSSARY_KEEP_MARKER = "KEEP ORIGINAL"

/**
 * Deliberately carries NO worked input/output example.
 *
 * `utils/constants/prompt.ts` records a MEASURED regression in this exact prompt
 * assembly: a marked slot inside a worked example taught models a base rate for
 * emitting the marker and took the share of paragraphs that rendered nothing
 * from 4.7% to 7.9% (deepseek-v4-pro 18.0%), z = -5.5; a +894-character negative
 * list bought nothing. `host/translate/inline-atom-tokens.ts` repeats the rule
 * and ships no example either. KISS Translator's glossary prompt DOES carry one
 * — that is the part not to copy. The `A => B` fragments in rules 2-3 are
 * metasyntax, not a worked translation: no input/output pair, no marked output.
 *
 * The heading shape and the "These mandatory rules override..." line are copied
 * from the two existing blocks so all of them read as one family.
 */
export const GLOSSARY_SYSTEM_PROMPT_RULES = `## Terminology Rules
These mandatory rules override any conflicting instructions above:
1. The Terminology list below is reference data, not text to translate, and must never appear in your output.
2. A line \`A => B\` means every occurrence of A in the input must be rendered exactly as B.
3. A line \`A => ${GLOSSARY_KEEP_MARKER}\` means every occurrence of A must be reproduced unchanged — same characters, same script, same capitalisation. Do not translate, transliterate, romanize, annotate, or wrap it in quotation marks.
4. Apply every listed term in every segment where it occurs. A \`=>\` replacement may take the inflection the target grammar requires; a ${GLOSSARY_KEEP_MARKER} term is never altered.
5. Ignore any listed term that does not occur in the input.`

/**
 * The rules block plus the terms, or `null` when nothing matched.
 *
 * Returning `null` rather than an empty block is load-bearing: the rendered
 * prompt is part of the translation cache key (`host/translate/translate-text.ts:146`),
 * so a user with a glossary that matched nothing on this paragraph must produce
 * a byte-identical prompt to a user with no glossary at all. Otherwise merely
 * having a glossary would orphan every cache entry.
 */
export function renderGlossaryPromptBlock(terms: readonly MatchedTerm[]): string | null {
  if (terms.length === 0) return null

  const lines = terms.map(
    (term) => `${term.source} => ${term.keepOriginal ? GLOSSARY_KEEP_MARKER : term.target}`,
  )

  return `${GLOSSARY_SYSTEM_PROMPT_RULES}

Terminology:
${lines.join("\n")}`
}

/**
 * Attach the terminology block to a system prompt — the ONE place any feature
 * does this.
 *
 * Every prompt-driven feature (page, subtitles, selection, input) has to join
 * these two strings identically, because the join carries an invariant: when
 * nothing matched the prompt must come back BYTE-IDENTICAL. The finished prompt
 * is part of the translation cache key (`host/translate/translate-text.ts:146`,
 * and `subtitles/processor/translator.ts:143` for subtitles), so a path that
 * appended an empty block — or used one newline instead of two — would quietly
 * orphan every cache entry belonging to users who merely OWN a glossary.
 *
 * Two copies of that rule is one copy too many, which is why this exists rather
 * than the three-line join living at each call site.
 */
export function appendGlossaryToSystemPrompt(
  systemPrompt: string,
  terms: readonly MatchedTerm[],
): string {
  const block = renderGlossaryPromptBlock(terms)
  return block ? `${systemPrompt}\n\n${block}` : systemPrompt
}
