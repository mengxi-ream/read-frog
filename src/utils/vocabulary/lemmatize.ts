// Lightweight rule-based candidate generator for common English inflections
// (plurals, -ed/-ing verb forms, comparatives). The frequency word list only
// contains base forms, so "predicted" or "analyzing" would otherwise be
// misjudged as rare even though "predict"/"analyze" are common. This is
// intentionally not a full stemmer (Porter etc.) — just enough coverage for
// regular inflections without adding a dependency; irregular forms
// ("went", "better") still fall through to the LLM-glossed path.

function stripDoubledConsonant(stem: string): string {
  const last = stem.at(-1)
  const secondLast = stem.at(-2)
  return last && last === secondLast && !"aeiou".includes(last) ? stem.slice(0, -1) : stem
}

export function generateLemmaCandidates(word: string): string[] {
  const candidates = new Set<string>()

  if (word.endsWith("ies") && word.length > 4) {
    candidates.add(`${word.slice(0, -3)}y`)
  }
  if (word.endsWith("es") && word.length > 3) {
    candidates.add(word.slice(0, -2))
  }
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) {
    candidates.add(word.slice(0, -1))
  }

  if (word.endsWith("ied") && word.length > 4) {
    candidates.add(`${word.slice(0, -3)}y`)
  }
  if (word.endsWith("ed") && word.length > 4) {
    const stem = word.slice(0, -2)
    candidates.add(stem)
    candidates.add(stripDoubledConsonant(stem))
    candidates.add(`${stem}e`)
  }

  if (word.endsWith("ing") && word.length > 5) {
    const stem = word.slice(0, -3)
    candidates.add(stem)
    candidates.add(stripDoubledConsonant(stem))
    candidates.add(`${stem}e`)
  }

  if (word.endsWith("iest") && word.length > 5) {
    candidates.add(`${word.slice(0, -4)}y`)
  } else if (word.endsWith("est") && word.length > 4) {
    candidates.add(word.slice(0, -3))
    candidates.add(word.slice(0, -4))
  }
  if (word.endsWith("ier") && word.length > 4) {
    candidates.add(`${word.slice(0, -3)}y`)
  } else if (word.endsWith("er") && word.length > 3) {
    candidates.add(word.slice(0, -2))
    candidates.add(word.slice(0, -3))
  }

  candidates.delete(word)
  return [...candidates]
}
