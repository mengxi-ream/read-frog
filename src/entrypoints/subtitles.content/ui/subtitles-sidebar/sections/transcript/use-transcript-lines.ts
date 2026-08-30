import type { UseQueryResult } from "@tanstack/react-query"
import type { TranscriptLine } from "@/utils/subtitles/transcript"
import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useMemo } from "react"
import { buildTranscript, findActiveLine } from "@/utils/subtitles/transcript"
import {
  currentTimeMsAtom,
  currentVideoIdAtom,
  sourceTrackAtom,
  translatedTrackAtom,
} from "../../../../atoms"
import { useSubtitlesUI } from "../../../subtitles-ui-context"

interface TranscriptLines {
  lines: TranscriptLine[]
  activeIndex: number
  query: UseQueryResult<boolean>
}

export function useTranscriptLines(): TranscriptLines {
  const { ensureSourceTrackPublished } = useSubtitlesUI()
  const source = useAtomValue(sourceTrackAtom)
  const translated = useAtomValue(translatedTrackAtom)
  const timeMs = useAtomValue(currentTimeMsAtom)
  const videoId = useAtomValue(currentVideoIdAtom)

  const lines = useMemo(() => buildTranscript(source, translated), [source, translated])

  const query = useQuery({
    queryKey: ["subtitles", "source-track", videoId],
    queryFn: async () => {
      await ensureSourceTrackPublished()
      return true
    },
    enabled: lines.length === 0,
    retry: false,
    staleTime: Infinity,
    meta: { suppressToast: true },
  })

  return { lines, activeIndex: findActiveLine(lines, timeMs), query }
}
