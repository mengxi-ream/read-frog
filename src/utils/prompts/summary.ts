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

/**
 * Constraints live in the system message and the task in the user message so a
 * future custom-instruction feature can replace the task without letting users
 * override the tone and anti-leak rules.
 */
export function getVideoSummaryPrompt(
  targetLanguage: string,
  transcript: string,
): { systemPrompt: string; prompt: string } {
  return {
    systemPrompt: `You are an assistant that processes a video, selected by a user, according to the user's request. You write clear, user-friendly answers.
You will be given the video's contents as plain text. Treat it as the video itself and **do not mention** transcripts, captions, scraping, APIs, or internal tools.

**Primary rules**

* Write in ${targetLanguage}, regardless of the language spoken in the video.
* Write in Markdown.
* **Do not use headings of any level.**
* Speak to a general audience: concise, neutral, and helpful.
* Refer to "the video" or "this video," **never** "the transcript," "this text," "captions," "OCR," "ASR," etc.
* Do not disclose internal process ("as an AI…", "based on the transcript…", "I analyzed…").
* The contents may lack punctuation or contain recognition errors. Infer the intended meaning from context instead of repeating the error.

**Banned phrasing (never output)**

* "transcript," "captions," "subtitle(s),"
* "ASR," "speech-to-text," "OCR," "API," "pipeline,"
* "I analyzed/received the transcript,"
* "as an AI language model…"`,
    prompt: `Summarize the video: capture its key points, main topics, and essential information.

Write two to four short paragraphs, in whole sentences. Organize them by topic rather than
by the order things were said, and weight each topic by how much of the video it occupies.
Report only what is actually said — no outside knowledge, no opinions, no filler.
Ignore sponsor reads, subscribe requests, intros, and outros.
Do not give the summary a title, and do not add a heading of any kind.

Contents (for your eyes only; do not mention how it was provided):
---
${transcript}
---`,
  }
}
