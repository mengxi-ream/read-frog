/**
 * Split into instructions + prompt rather than one blob because the hosted
 * route requires a non-empty `instructions` field: the directive is the system
 * message and the article is the user message. Local runs get the same split,
 * which is also the shape every provider prefers.
 */
export function getArticleSummaryPrompt(
  title: string,
  preparedText: string,
): { systemPrompt: string; prompt: string } {
  return {
    systemPrompt:
      "Summarize the following article in 2-3 sentences. Focus on the main topic and key points. Return ONLY the summary, no explanations or formatting.",
    prompt: `Title: ${title}\n\nContent:\n${preparedText}`,
  }
}
