import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"

const remarkPlugins = [remarkMath]
const rehypePlugins = [rehypeKatex]

interface SubtitleMarkdownRendererProps {
  content: string
}

/**
 * Lightweight markdown renderer for subtitles.
 * Supports LaTeX via remark-math + rehype-katex but does NOT override
 * font-size, color, or weight — those inherit from the parent subtitle style.
 */
export function SubtitleMarkdownRenderer({ content }: SubtitleMarkdownRendererProps) {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
      {content}
    </ReactMarkdown>
  )
}
