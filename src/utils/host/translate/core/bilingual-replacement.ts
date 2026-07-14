import {
  BLOCK_CONTENT_CLASS,
  CONTENT_WRAPPER_CLASS,
  INLINE_CONTENT_CLASS,
  SPINNER_CLASS,
  TRANSLATION_ERROR_CONTAINER_CLASS,
  WALKED_ATTRIBUTE,
} from "@/utils/constants/dom-labels"
import { isTranslatedWrapperNode } from "../../dom/filter"
import {
  collectSourceTextExcludingWrappers,
  getBilingualTranslationStateForSource,
  getBilingualTranslationStateForWrapper,
  getPendingBilingualTranslationStates,
  registerBilingualTranslationState,
  unregisterBilingualTranslationState,
} from "./translation-state"

type TranslationPresentation = "block" | "inline" | "pending"

interface HostElementPathStep {
  index: number
  tagName: string
}

export interface BilingualReplacementSnapshot {
  key: string
  rootTagName: string
  rootTextContent: string
  sourceTagName: string
  sourceTextContent: string
  sourcePath: HostElementPathStep[]
  insertionParentPath: HostElementPathStep[]
  presentation: TranslationPresentation
  reusable: boolean
  wrapperTemplate?: HTMLElement
  detachedWrapper?: HTMLElement
}

export interface BilingualReplacementMatch {
  insertionParent: HTMLElement
  source: HTMLElement
}

function getHostElementChildren(parent: HTMLElement): HTMLElement[] {
  return [...parent.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && !isTranslatedWrapperNode(child),
  )
}

function getHostElementPath(
  root: HTMLElement,
  target: HTMLElement,
): HostElementPathStep[] | undefined {
  if (root === target) return []

  const path: HostElementPathStep[] = []
  let current: HTMLElement | null = target
  while (current && current !== root) {
    const parent: HTMLElement | null = current.parentElement
    if (!parent) return undefined
    const index = getHostElementChildren(parent).indexOf(current)
    if (index < 0) return undefined
    path.unshift({ index, tagName: current.tagName })
    current = parent
  }
  return current === root ? path : undefined
}

function resolveHostElementPath(
  root: HTMLElement,
  path: readonly HostElementPathStep[],
): HTMLElement | undefined {
  let current = root
  for (const step of path) {
    const next = getHostElementChildren(current)[step.index]
    if (!next || next.tagName !== step.tagName) return undefined
    current = next
  }
  return current
}

function getPresentation(wrapper: HTMLElement): TranslationPresentation | undefined {
  const hasBlock = wrapper.querySelector(`.${BLOCK_CONTENT_CLASS}`) !== null
  const hasInline = wrapper.querySelector(`.${INLINE_CONTENT_CLASS}`) !== null
  if (hasBlock === hasInline) return undefined
  return hasBlock ? "block" : "inline"
}

function createSnapshotKey(
  rootTagName: string,
  rootTextContent: string,
  sourceTagName: string,
  sourceTextContent: string,
  sourcePath: readonly HostElementPathStep[],
  insertionParentPath: readonly HostElementPathStep[],
  presentation: TranslationPresentation,
): string {
  return JSON.stringify([
    rootTagName,
    rootTextContent,
    sourceTagName,
    sourceTextContent,
    sourcePath,
    insertionParentPath,
    presentation,
  ])
}

/**
 * Capture ordinary bilingual generations owned by a subtree the host page
 * removed. Completed wrappers can be restored; pending/error generations only
 * contribute a logical fingerprint for the cross-node circuit breaker.
 * Virtual paragraphs use a separate lifecycle and intentionally fall through.
 */
export function captureBilingualReplacements(
  removedRoot: HTMLElement,
  walkId: string,
): BilingualReplacementSnapshot[] {
  const wrappers = [
    ...(removedRoot.classList.contains(CONTENT_WRAPPER_CLASS) ? [removedRoot] : []),
    ...removedRoot.querySelectorAll<HTMLElement>(`.${CONTENT_WRAPPER_CLASS}`),
  ]
  const snapshots: BilingualReplacementSnapshot[] = []
  const rootTagName = removedRoot.tagName
  const rootTextContent = collectSourceTextExcludingWrappers(removedRoot)

  for (const wrapper of wrappers) {
    const state = getBilingualTranslationStateForWrapper(wrapper)
    if (
      !state ||
      state.walkId !== walkId ||
      !removedRoot.contains(state.layoutSource) ||
      !state.layoutSource.contains(wrapper)
    ) {
      continue
    }

    const sourceTextContent = collectSourceTextExcludingWrappers(state.layoutSource)
    if (sourceTextContent !== state.sourceTextContent) continue

    const sourcePath = getHostElementPath(removedRoot, state.layoutSource)
    const insertionParent = wrapper.parentElement
    const insertionParentPath = insertionParent
      ? getHostElementPath(state.layoutSource, insertionParent)
      : undefined
    const finalPresentation = getPresentation(wrapper)
    const reusable =
      state.phase === "complete" &&
      finalPresentation !== undefined &&
      !wrapper.querySelector(`.${SPINNER_CLASS}, .${TRANSLATION_ERROR_CONTAINER_CLASS}`)
    const presentation = finalPresentation ?? "pending"
    if (!sourcePath || !insertionParentPath) continue

    const sourceTagName = state.layoutSource.tagName
    snapshots.push({
      key: createSnapshotKey(
        rootTagName,
        rootTextContent,
        sourceTagName,
        sourceTextContent,
        sourcePath,
        insertionParentPath,
        presentation,
      ),
      rootTagName,
      rootTextContent,
      sourceTagName,
      sourceTextContent,
      sourcePath,
      insertionParentPath,
      presentation,
      reusable,
      wrapperTemplate: reusable ? (wrapper.cloneNode(true) as HTMLElement) : undefined,
      detachedWrapper: reusable ? wrapper : undefined,
    })
    unregisterBilingualTranslationState(state)
  }

  for (const state of getPendingBilingualTranslationStates()) {
    if (
      state.wrapper !== null ||
      state.walkId !== walkId ||
      !removedRoot.contains(state.layoutSource)
    ) {
      continue
    }
    const sourceTextContent = collectSourceTextExcludingWrappers(state.layoutSource)
    if (sourceTextContent !== state.sourceTextContent) {
      unregisterBilingualTranslationState(state)
      continue
    }
    const sourcePath = getHostElementPath(removedRoot, state.layoutSource)
    if (!sourcePath) {
      unregisterBilingualTranslationState(state)
      continue
    }
    const sourceTagName = state.layoutSource.tagName
    const insertionParentPath: HostElementPathStep[] = []
    const presentation = "pending" as const
    snapshots.push({
      key: createSnapshotKey(
        rootTagName,
        rootTextContent,
        sourceTagName,
        sourceTextContent,
        sourcePath,
        insertionParentPath,
        presentation,
      ),
      rootTagName,
      rootTextContent,
      sourceTagName,
      sourceTextContent,
      sourcePath,
      insertionParentPath,
      presentation,
      reusable: false,
    })
    unregisterBilingualTranslationState(state)
  }

  return snapshots
}

export function matchBilingualReplacement(
  addedRoot: HTMLElement,
  addedRootTextContent: string,
  snapshot: BilingualReplacementSnapshot,
): BilingualReplacementMatch | undefined {
  if (
    addedRoot.tagName !== snapshot.rootTagName ||
    addedRootTextContent !== snapshot.rootTextContent
  ) {
    return undefined
  }
  const source = resolveHostElementPath(addedRoot, snapshot.sourcePath)
  if (
    !source ||
    source.tagName !== snapshot.sourceTagName ||
    getBilingualTranslationStateForSource(source) ||
    collectSourceTextExcludingWrappers(source) !== snapshot.sourceTextContent
  ) {
    return undefined
  }

  const insertionParent = resolveHostElementPath(source, snapshot.insertionParentPath)
  if (!insertionParent) return undefined

  return { insertionParent, source }
}

export function isBilingualReplacementMatchCurrent(
  match: BilingualReplacementMatch,
  snapshot: BilingualReplacementSnapshot,
): boolean {
  return (
    match.source.tagName === snapshot.sourceTagName &&
    collectSourceTextExcludingWrappers(match.source) === snapshot.sourceTextContent &&
    resolveHostElementPath(match.source, snapshot.insertionParentPath) === match.insertionParent
  )
}

export function restoreCompletedBilingualReplacement(
  match: BilingualReplacementMatch,
  snapshot: BilingualReplacementSnapshot,
  walkId: string,
  reuseDetachedWrapper: boolean,
): HTMLElement {
  if (!snapshot.reusable || !snapshot.wrapperTemplate) {
    throw new Error("Cannot restore an incomplete bilingual translation")
  }
  const wrapper =
    reuseDetachedWrapper && snapshot.detachedWrapper
      ? snapshot.detachedWrapper
      : (snapshot.wrapperTemplate.cloneNode(true) as HTMLElement)
  snapshot.detachedWrapper = undefined
  wrapper.setAttribute(WALKED_ATTRIBUTE, walkId)
  match.insertionParent.append(wrapper)
  registerBilingualTranslationState({
    layoutSource: match.source,
    sourceTextContent: snapshot.sourceTextContent,
    phase: "complete",
    status: "active",
    walkId,
    wrapper,
  })
  return wrapper
}
