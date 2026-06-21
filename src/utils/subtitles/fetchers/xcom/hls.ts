export interface XcomSubtitleRendition {
  autoselect: boolean
  default: boolean
  groupId: string
  language: string
  name: string
  uri: string
}

export interface XcomTextTrackSnapshot {
  label: string
  language: string
  mode: string
}

function parseBooleanAttribute(value: string | undefined): boolean {
  return value?.toUpperCase() === "YES"
}

export function parseHlsAttributeList(line: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  const rawAttributes = line.replace(/^#EXT-X-[^:]+:/, "")
  const attributePattern = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g

  for (const match of rawAttributes.matchAll(attributePattern)) {
    attributes[match[1]] = match[2].replace(/^"|"$/g, "")
  }

  return attributes
}

export function parseSubtitleRenditions(manifestUrl: string, manifestText: string): XcomSubtitleRendition[] {
  return manifestText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith("#EXT-X-MEDIA:"))
    .map(parseHlsAttributeList)
    .filter(attributes => attributes.TYPE === "SUBTITLES" && !!attributes.URI)
    .map(attributes => ({
      autoselect: parseBooleanAttribute(attributes.AUTOSELECT),
      default: parseBooleanAttribute(attributes.DEFAULT),
      groupId: attributes["GROUP-ID"] ?? "",
      language: attributes.LANGUAGE ?? "",
      name: attributes.NAME ?? "",
      uri: new URL(attributes.URI, manifestUrl).href,
    }))
}

export function resolveSubtitleSegmentUrls(playlistUrl: string, playlistText: string): string[] {
  return playlistText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith("#"))
    .map(line => new URL(line, playlistUrl).href)
}

function matchesTextTrack(rendition: XcomSubtitleRendition, selectedTrack: XcomTextTrackSnapshot): boolean {
  const selectedLanguage = selectedTrack.language.trim().toLowerCase()
  const selectedLabel = selectedTrack.label.trim().toLowerCase()
  const renditionLanguage = rendition.language.trim().toLowerCase()
  const renditionName = rendition.name.trim().toLowerCase()

  return (!!selectedLanguage && selectedLanguage === renditionLanguage)
    || (!!selectedLabel && selectedLabel === renditionName)
}

export function orderSubtitleRenditions(
  renditions: XcomSubtitleRendition[],
  selectedTrack: XcomTextTrackSnapshot | null,
): XcomSubtitleRendition[] {
  if (renditions.length <= 1) {
    return renditions
  }

  const selected = selectedTrack
    ? renditions.find(rendition => matchesTextTrack(rendition, selectedTrack))
    : undefined
  const defaultTrack = renditions.find(rendition => rendition.default)
  const autoselectTrack = renditions.find(rendition => rendition.autoselect)
  const preferred = [selected, defaultTrack, autoselectTrack]
    .filter((track): track is XcomSubtitleRendition => !!track)

  return [
    ...preferred,
    ...renditions,
  ].filter((track, index, tracks) => tracks.indexOf(track) === index)
}
