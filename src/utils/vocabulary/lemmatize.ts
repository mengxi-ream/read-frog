// Lightweight rule-based candidate generator for common English inflections
// (plurals, -ed/-ing verb forms, comparatives). The frequency word list only
// contains base forms, so "predicted" or "analyzing" would otherwise be
// misjudged as rare even though "predict"/"analyze" are common. This is
// intentionally not a full stemmer (Porter etc.) — just enough coverage for
// regular inflections without adding a dependency; irregular forms
// ("went", "better") still fall through to the LLM-glossed path.

function stripDoubledConsonant(stem: string): string {
  const last = stem.at(-1)
  return last && last === stem.at(-2) && !"aeiou".includes(last) ? stem.slice(0, -1) : stem
}

// [suffix, minLength, buildCandidates]. Order matters: "-ied"/"-iest"/"-ier"
// must be checked before the shorter "-ed"/"-est"/"-er" so e.g. "tried"
// yields "try" instead of a bogus "tri"/"tried" stem.
const RULES: [string, number, (stem: string) => string[]][] = [
  ["ies", 4, (s) => [`${s}y`]],
  ["es", 3, (s) => [s]],
  ["s", 3, (s) => (s.endsWith("s") ? [] : [s])],
  ["ied", 4, (s) => [`${s}y`]],
  ["ed", 4, (s) => [s, stripDoubledConsonant(s), `${s}e`]],
  ["ing", 5, (s) => [s, stripDoubledConsonant(s), `${s}e`]],
  ["iest", 5, (s) => [`${s}y`]],
  ["est", 4, (s) => [s, s.slice(0, -1)]],
  ["ier", 4, (s) => [`${s}y`]],
  ["er", 3, (s) => [s, s.slice(0, -1)]],
]

export function generateLemmaCandidates(word: string): string[] {
  const candidates = new Set<string>()
  for (const [suffix, minLength, build] of RULES) {
    if (!word.endsWith(suffix) || word.length <= minLength) continue
    for (const candidate of build(word.slice(0, -suffix.length))) candidates.add(candidate)
  }
  candidates.delete(word)
  return [...candidates]
}
