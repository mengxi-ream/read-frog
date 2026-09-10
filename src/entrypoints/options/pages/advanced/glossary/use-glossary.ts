import type { ParsedGlossaryRow } from "@/utils/glossary/csv"
import type { GlossaryTermInput, ImportMode } from "@/utils/glossary/repository"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  countGlossaryTermsByGlossary,
  createGlossary,
  deleteAllGlossaryTerms,
  deleteGlossary,
  deleteGlossaryTerm,
  getGlossary,
  importGlossaryRows,
  listGlossaries,
  listGlossaryTerms,
  saveGlossaryTerm,
  setGlossaryEnabled,
  setGlossaryPatterns,
  setGlossaryTermEnabled,
  updateGlossaryMeta,
} from "@/utils/glossary/repository"

const GLOSSARIES_QUERY_KEY = ["glossaries"] as const
const TERM_COUNTS_QUERY_KEY = ["glossary-term-counts"] as const

function glossaryQueryKey(glossaryId: string) {
  return ["glossary", glossaryId] as const
}

function termsQueryKey(glossaryId: string) {
  return ["glossary-terms", glossaryId] as const
}

/**
 * One place to invalidate from.
 *
 * Every mutation refreshes all of it rather than picking: the counts shown on
 * the list depend on term writes, the list row's subtitle depends on the
 * glossary's own fields, and getting that wrong shows a stale count next to a
 * fresh name.
 */
function useGlossaryInvalidation() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: GLOSSARIES_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: TERM_COUNTS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["glossary"] }),
      queryClient.invalidateQueries({ queryKey: ["glossary-terms"] }),
    ])
}

// ---------------------------------------------------------------------------
// Glossaries
// ---------------------------------------------------------------------------

export function useGlossaries() {
  return useQuery({ queryKey: GLOSSARIES_QUERY_KEY, queryFn: listGlossaries })
}

export function useGlossaryTermCounts() {
  return useQuery({ queryKey: TERM_COUNTS_QUERY_KEY, queryFn: countGlossaryTermsByGlossary })
}

export function useGlossary(glossaryId: string) {
  return useQuery({
    queryKey: glossaryQueryKey(glossaryId),
    queryFn: () => getGlossary(glossaryId),
  })
}

export function useCreateGlossary() {
  const invalidate = useGlossaryInvalidation()
  return useMutation({ mutationFn: createGlossary, onSuccess: () => void invalidate() })
}

export function useUpdateGlossaryMeta() {
  const invalidate = useGlossaryInvalidation()
  return useMutation({
    mutationFn: ({ id, ...meta }: { id: string; name?: string; description?: string }) =>
      updateGlossaryMeta(id, meta),
    onSuccess: () => void invalidate(),
  })
}

export function useSetGlossaryEnabled() {
  const invalidate = useGlossaryInvalidation()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      setGlossaryEnabled(id, enabled),
    onSuccess: () => void invalidate(),
  })
}

export function useSetGlossaryPatterns() {
  const invalidate = useGlossaryInvalidation()
  return useMutation({
    mutationFn: ({ id, patterns }: { id: string; patterns: string[] }) =>
      setGlossaryPatterns(id, patterns),
    onSuccess: () => void invalidate(),
  })
}

export function useDeleteGlossary() {
  const invalidate = useGlossaryInvalidation()
  return useMutation({ mutationFn: deleteGlossary, onSuccess: () => void invalidate() })
}

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

export function useGlossaryTerms(glossaryId: string) {
  return useQuery({
    queryKey: termsQueryKey(glossaryId),
    queryFn: () => listGlossaryTerms(glossaryId),
  })
}

export function useSaveGlossaryTerm(glossaryId: string) {
  const invalidate = useGlossaryInvalidation()
  return useMutation({
    mutationFn: ({ input, id }: { input: GlossaryTermInput; id?: string }) =>
      saveGlossaryTerm(glossaryId, input, id),
    onSuccess: () => void invalidate(),
  })
}

export function useSetGlossaryTermEnabled() {
  const invalidate = useGlossaryInvalidation()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      setGlossaryTermEnabled(id, enabled),
    onSuccess: () => void invalidate(),
  })
}

export function useDeleteGlossaryTerm() {
  const invalidate = useGlossaryInvalidation()
  return useMutation({
    mutationFn: (id: string) => deleteGlossaryTerm(id),
    onSuccess: () => void invalidate(),
  })
}

export function useDeleteAllGlossaryTerms(glossaryId: string) {
  const invalidate = useGlossaryInvalidation()
  return useMutation({
    mutationFn: () => deleteAllGlossaryTerms(glossaryId),
    onSuccess: () => void invalidate(),
  })
}

export function useImportGlossary(glossaryId: string) {
  const invalidate = useGlossaryInvalidation()
  return useMutation({
    mutationFn: ({
      rows,
      mode,
      caseSensitive,
    }: {
      rows: ParsedGlossaryRow[]
      mode: ImportMode
      caseSensitive: boolean
    }) => importGlossaryRows(glossaryId, rows, mode, caseSensitive),
    onSuccess: () => void invalidate(),
  })
}
