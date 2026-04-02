import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"

// Disable single-dollar math so currency like "$5" isn't parsed as LaTeX.
// Block math ($$...$$) still works for real equations.
const remarkPlugins = [[remarkMath, { singleDollarTextMath: false }] as [typeof remarkMath, { singleDollarTextMath: boolean }]]
const rehypePlugins = [rehypeKatex]

interface SubtitleMarkdownRendererProps {
  content: string
}

// Override block/emphasis elements so only math is rendered; underscores,
// asterisks, and paragraph margins are neutralised for subtitle display.
const components = {
  p: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  em: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  strong: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}

/**
 * Lightweight markdown renderer for subtitles.
 * Supports LaTeX via remark-math + rehype-katex but does NOT override
 * font-size, color, or weight — those inherit from the parent subtitle style.
 * Emphasis / strong / paragraph markup is stripped to prevent false formatting.
 */
export function SubtitleMarkdownRenderer({ content }: SubtitleMarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={components}
    >
      {content}
    </ReactMarkdown>
  )
}
