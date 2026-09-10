/**
 * Word-boundary rules for glossary matching, across every script we translate.
 *
 * `\b` cannot be used here. It is defined as the edge between `\w` and non-`\w`,
 * and in JavaScript `\w` is hard-wired to `[A-Za-z0-9_]` even under the `u`
 * flag. That breaks in both directions:
 *
 *   /\b机器学习\b/u.test("这是机器学习的东西")  -> false
 *     Neither 是 nor 机 is `\w`, so no boundary exists and EVERY CJK term
 *     silently fails to match — for exactly the users who asked for this feature.
 *
 *   /\bcaf\b/.test("café")                    -> true
 *     `f` is `\w` and `é` is not, so a boundary is found mid-word and the term
 *     over-matches inside accented Latin, Cyrillic and Greek.
 *
 * The rule below instead asks a question `\b` cannot: *would this neighbouring
 * character glue onto the term?* Letters, digits, combining marks and connector
 * punctuation would. Characters from scripts that do not separate words with
 * spaces would not — adjacency is simply how those scripts are written, so
 * treating a neighbour as "glue" there is what breaks CJK.
 */

/** Characters that would read as part of the same word if adjacent. */
const WORDISH = /[\p{L}\p{N}\p{M}\p{Pc}]/u

/**
 * Scripts written without spaces between words. Their characters are wordish
 * but must never block a match, otherwise no CJK term ever matches and a Latin
 * term can never be found inside CJK text (`AI` in `我用AI工作`).
 */
const SPACELESS_SCRIPT =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u

function isBlocking(char: string | undefined): boolean {
  if (char === undefined) return false
  return WORDISH.test(char) && !SPACELESS_SCRIPT.test(char)
}

/**
 * Whether a term's own edge can be glued to by a neighbour. A term ending in
 * punctuation (`C++`, `.NET`) has nothing to glue to on that side, so that side
 * is never checked — which is what lets `C++` match in `I write C++ daily` and
 * `GPU` match in `GPU/CPU`.
 */
export interface BoundaryRequirement {
  start: boolean
  end: boolean
}

export function boundaryRequirementOf(term: string): BoundaryRequirement {
  return {
    start: isBlocking(term[0]),
    end: isBlocking(term[term.length - 1]),
  }
}

/**
 * True when the match at `[start, end)` stands as its own word.
 *
 * @param requirement - precomputed from the TERM, not the text, so the cost per
 *   match is two character tests.
 */
export function isAtWordBoundary(
  text: string,
  start: number,
  end: number,
  requirement: BoundaryRequirement,
): boolean {
  if (requirement.start && isBlocking(text[start - 1])) return false
  if (requirement.end && isBlocking(text[end])) return false
  return true
}
