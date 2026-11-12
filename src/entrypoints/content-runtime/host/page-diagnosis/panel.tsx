import type {
  DiagnosedParagraph,
  UntranslatedReason,
} from "@/utils/host/translate/paragraph-diagnosis"
import { IconX } from "@tabler/icons-react"
import * as React from "react"
import {
  getDiagnosedParagraphs,
  subscribeParagraphDiagnosis,
  UNTRANSLATED_REASONS,
} from "@/utils/host/translate/paragraph-diagnosis"
import { i18n } from "@/utils/i18n"

// Outlines must read on any site, so they carry their own colors rather than the theme's.
export const REASON_COLORS: Record<UntranslatedReason, string> = {
  noProse: "#94a3b8",
  tooShort: "#f59e0b",
  targetLanguage: "#0ea5e9",
  skipLanguage: "#8b5cf6",
  noTranslationNeeded: "#d946ef",
  sameAsSource: "#f97316",
  emptyResult: "#f43f5e",
  error: "#dc2626",
}

/** Past this many, more outlines tell nobody anything, and each one costs a layout read. */
const MAX_OUTLINES = 300

const TOP_LAYER = 2147483647

/** Re-read at most once a frame: a page can settle hundreds of paragraphs at once. */
function useDiagnosedParagraphs(): DiagnosedParagraph[] {
  const [, setVersion] = React.useState(0)
  React.useEffect(() => {
    let frame: number | undefined
    const unsubscribe = subscribeParagraphDiagnosis(() => {
      frame ??= requestAnimationFrame(() => {
        frame = undefined
        setVersion((version) => version + 1)
      })
    })
    return () => {
      unsubscribe()
      if (frame !== undefined) cancelAnimationFrame(frame)
    }
  }, [])
  return getDiagnosedParagraphs()
}

// Outline keys follow the element, so a box keeps its node while the list changes.
const outlineKeys = new WeakMap<Element, number>()
let nextOutlineKey = 0

function outlineKeyOf(element: Element): number {
  let key = outlineKeys.get(element)
  if (key === undefined) {
    key = nextOutlineKey++
    outlineKeys.set(element, key)
  }
  return key
}

interface Outline {
  key: number
  rect: DOMRect
}

/** Boxes over the page's own paragraphs, so the page itself is never touched. */
function ParagraphOutlines({ elements, color }: { elements: Element[]; color: string }) {
  const [outlines, setOutlines] = React.useState<Outline[]>([])

  React.useLayoutEffect(() => {
    // Paragraphs split out of one container share it, and one box is enough.
    const outlined = [...new Set(elements)].slice(0, MAX_OUTLINES)
    let frame: number | undefined
    const measure = () => {
      frame = undefined
      setOutlines(
        outlined.map((element) => ({
          key: outlineKeyOf(element),
          rect: element.getBoundingClientRect(),
        })),
      )
    }
    const scheduleMeasure = () => {
      frame ??= requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener("scroll", scheduleMeasure, { capture: true, passive: true })
    window.addEventListener("resize", scheduleMeasure, { passive: true })
    return () => {
      window.removeEventListener("scroll", scheduleMeasure, { capture: true })
      window.removeEventListener("resize", scheduleMeasure)
      if (frame !== undefined) cancelAnimationFrame(frame)
    }
  }, [elements])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: TOP_LAYER }}>
      {outlines.map(
        ({ key, rect }) =>
          rect.width > 0 &&
          rect.height > 0 && (
            <div
              key={key}
              className="absolute rounded-sm"
              style={{
                left: rect.left - 2,
                top: rect.top - 2,
                width: rect.width + 4,
                height: rect.height + 4,
                outline: `2px solid ${color}`,
                backgroundColor: `${color}1a`,
              }}
            />
          ),
      )}
    </div>
  )
}

/**
 * "Diagnose this page": how many paragraphs page translation left alone here,
 * grouped by why, with a click outlining each group on the page.
 */
export function PageDiagnosisPanel({ onClose }: { onClose: () => void }) {
  const paragraphs = useDiagnosedParagraphs()
  const [outlinedReason, setOutlinedReason] = React.useState<UntranslatedReason | null>(null)

  React.useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  const counts = new Map<string, number>()
  for (const { verdict } of paragraphs) counts.set(verdict, (counts.get(verdict) ?? 0) + 1)
  const translatedCount = counts.get("translated") ?? 0
  const reasons = UNTRANSLATED_REASONS.filter((reason) => counts.has(reason))
  const outlinedElements = paragraphs
    .filter(({ verdict }) => verdict === outlinedReason)
    .map(({ element }) => element)

  const toggleOutline = (reason: UntranslatedReason) => {
    const next = outlinedReason === reason ? null : reason
    setOutlinedReason(next)
    if (next) {
      paragraphs
        .find(({ verdict }) => verdict === next)
        ?.element.scrollIntoView({ block: "center", behavior: "smooth" })
    }
  }

  return (
    <>
      {outlinedReason && (
        <ParagraphOutlines elements={outlinedElements} color={REASON_COLORS[outlinedReason]} />
      )}
      <aside
        aria-label={i18n.t("pageDiagnosis.title")}
        className="fixed top-4 right-4 flex w-80 flex-col gap-3 rounded-xl border bg-background p-4 text-sm text-foreground shadow-lg"
        style={{ zIndex: TOP_LAYER }}
      >
        <header className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{i18n.t("pageDiagnosis.title")}</h2>
          <button
            type="button"
            aria-label={i18n.t("pageDiagnosis.close")}
            onClick={onClose}
            className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <IconX className="size-4" />
          </button>
        </header>

        {paragraphs.length === 0 ? (
          <p className="text-muted-foreground">{i18n.t("pageDiagnosis.empty")}</p>
        ) : (
          <>
            <p className="text-muted-foreground">
              {i18n.t("pageDiagnosis.summary", [
                translatedCount,
                paragraphs.length - translatedCount,
              ])}
            </p>
            {reasons.length > 0 && (
              <ul className="flex flex-col gap-1">
                {reasons.map((reason) => (
                  <li key={reason}>
                    <button
                      type="button"
                      aria-pressed={outlinedReason === reason}
                      onClick={() => toggleOutline(reason)}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted aria-pressed:bg-muted"
                    >
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: REASON_COLORS[reason] }}
                      />
                      <span className="flex-1">{i18n.t(`pageDiagnosis.reasons.${reason}`)}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {counts.get(reason)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">{i18n.t("pageDiagnosis.hint")}</p>
          </>
        )}
      </aside>
    </>
  )
}
