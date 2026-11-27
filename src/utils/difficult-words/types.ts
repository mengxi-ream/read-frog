import type { VocabJudgeOutput, VocabLang } from "@read-frog/api-contract"
import { VOCAB_LANGS } from "@read-frog/api-contract"

/** Why a `vocab.judge` request did not go through, as the page acts on it. */
export type DifficultWordsFailure =
  | { kind: "signedOut" }
  /** The account is not in the beta. */
  | { kind: "restricted" }
  | { kind: "dailyLimit"; resetAt: string | null }
  | { kind: "rateLimited"; resetAt: string | null }
  /** No connection, or the server failing: tried again on its own. */
  | { kind: "offline" }
  /** Anything else, a request the server refused as malformed among them. */
  | { kind: "error" }

export type DifficultWordsJudgeResponse =
  | { ok: true; output: VocabJudgeOutput }
  | { ok: false; failure: DifficultWordsFailure }

/** Whether this account may use difficult words; "unknown" when it could not be asked. */
export type DifficultWordsAccess = "allowed" | "denied" | "signedOut" | "unknown"

/** What the popup shows for a tab. */
export interface DifficultWordsTabState {
  enabled: boolean
  /** How many different words are marked on the page. */
  count: number
}

/** Where marking was switched on from. */
export type DifficultWordsSurface = "popup" | "floating_button" | "shortcut"

/** A word whose marks one tab removed (`known`) or brought back, for the other tabs. */
export interface DifficultWordLemmaChange {
  lang: VocabLang
  lemma: string
  known: boolean
}

const VOCAB_LANG_SET: ReadonlySet<string> = new Set(VOCAB_LANGS)

export function isVocabLang(value: unknown): value is VocabLang {
  return typeof value === "string" && VOCAB_LANG_SET.has(value)
}
