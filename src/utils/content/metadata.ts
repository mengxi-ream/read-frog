function normalizeMetaContent(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? ""
}

export function getDocumentDescription(doc: Document = document): string {
  const selectors = [
    "meta[name=\"description\"]",
    "meta[property=\"og:description\"]",
    "meta[name=\"twitter:description\"]",
  ]

  for (const selector of selectors) {
    const content = normalizeMetaContent(
      doc.querySelector<HTMLMetaElement>(selector)?.content,
    )
    if (content) {
      return content
    }
  }

  return ""
}
