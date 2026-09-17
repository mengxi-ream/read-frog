import type { SaveGlossaryTermResult } from "@/utils/glossary/repository"
import { MAX_GLOSSARY_TERMS } from "@/utils/constants/glossary"
import { i18n } from "@/utils/i18n"

type SaveTermFailure = Extract<SaveGlossaryTermResult, { ok: false }>["reason"]

/**
 * The message shown when a term write is refused.
 *
 * Shared by the add form and the table's inline editor, because the one refusal
 * that needs a substitution must not be got right in one place and wrong in the
 * other: `capReached` counts EVERY glossary, so its text carries the number, and
 * interpolating the reason straight into the key — which is what the other three
 * reasons want — would print a literal `$1` instead.
 *
 * An edit never actually reaches `capReached`: `saveGlossaryTerm` only measures
 * the cap when it is creating a row. Handling it here anyway is what lets the
 * editor pass a raw `reason` through without knowing that.
 *
 * The strings are the add form's. They read the same for an edit — "That term is
 * already in your glossary" is the same refusal either way — and a parallel set
 * of `editError.*` keys would be ten locales of duplicate text kept in sync by
 * hand.
 */
export function saveTermErrorTitle(reason: SaveTermFailure): string {
  if (reason === "capReached") {
    return i18n.t("options.advanced.glossary.addError.capReached", [String(MAX_GLOSSARY_TERMS)])
  }
  return i18n.t(`options.advanced.glossary.addError.${reason}`)
}
