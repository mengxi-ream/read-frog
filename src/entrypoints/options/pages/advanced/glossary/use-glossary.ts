import type { ParsedGlossaryRow } from "@/utils/glossary/csv"
import type { ImportMode } from "@/utils/glossary/repository"
import type { GlossaryTermInput } from "@/utils/glossary/repository"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  deleteAllGlossaryTerms,
  deleteGlossaryTerm,
  importGlossaryRows,
  listGlossaryTerms,
  saveGlossaryTerm,
  setGlossaryTermEnabled,
} from "@/utils/glossary/repository"

export const GLOSSARY_QUERY_KEY = ["glossary-terms"] as const

export function useGlossaryTerms() {
  return useQuery({ queryKey: GLOSSARY_QUERY_KEY, queryFn: listGlossaryTerms })
}

/** One place to invalidate from, so every mutation refreshes the table the same way. */
function useGlossaryInvalidation() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: GLOSSARY_QUERY_KEY })
}

export function useSaveGlossaryTerm() {
  const invalidate = useGlossaryInvalidation()
  return useMutation({
    mutationFn: ({ input, id }: { input: GlossaryTermInput; id?: string }) =>
      saveGlossaryTerm(input, id),
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

export function useDeleteAllGlossaryTerms() {
  const invalidate = useGlossaryInvalidation()
  return useMutation({
    mutationFn: deleteAllGlossaryTerms,
    onSuccess: () => void invalidate(),
  })
}

export function useImportGlossary() {
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
    }) => importGlossaryRows(rows, mode, caseSensitive),
    onSuccess: () => void invalidate(),
  })
}
