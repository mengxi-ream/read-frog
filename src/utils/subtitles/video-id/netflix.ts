import { NETFLIX_WATCH_PATH_PATTERN } from "@/utils/constants/subtitles"

export function getNetflixMovieId(): string | null {
  return window.location.pathname.match(NETFLIX_WATCH_PATH_PATTERN)?.[1] ?? null
}
