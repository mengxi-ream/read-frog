import ReactMarkdown, { type Components } from "react-markdown"

interface MarkdownRendererProps {
  content: string
  className?: string
}

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mt-6 mb-4 flex items-center border-b border-slate-200 pb-2 text-lg font-bold text-slate-800 first:mt-0 dark:border-slate-700 dark:text-slate-100">
      <span className="mr-3 h-2 w-2 rounded-full bg-blue-500"></span>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-5 mb-3 flex items-center text-base font-semibold text-slate-800 first:mt-0 dark:text-slate-100">
      <span className="mr-2 h-1.5 w-1.5 rounded-full bg-green-500"></span>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-2 flex items-center text-sm font-semibold text-slate-800 first:mt-0 dark:text-slate-100">
      <span className="mr-2 h-1 w-1 rounded-full bg-orange-500"></span>
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-4 mb-2 flex items-center text-sm font-semibold text-slate-800 first:mt-0 dark:text-slate-100">
      <span className="mr-2 h-1 w-1 rounded-full bg-purple-500"></span>
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mt-3 mb-3 text-sm leading-relaxed text-slate-700 first:mt-0 dark:text-slate-300">
      {children}
    </p>
  ),
  ul: ({ children }) => <ul className="mt-3 mb-3 space-y-2 first:mt-0">{children}</ul>,
  ol: ({ children }) => <ol className="mt-3 mb-3 space-y-2 first:mt-0">{children}</ol>,
  li: ({ children }) => (
    <li className="flex items-start text-sm text-slate-700 dark:text-slate-300">
      <span className="mt-2 mr-3 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400 dark:bg-slate-500"></span>
      <span className="flex-1">{children}</span>
    </li>
  ),
  strong: ({ children }) => (
    <strong className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className="rounded bg-slate-50 px-1 py-0.5 text-slate-600 italic dark:bg-slate-800/50 dark:text-slate-400">
      {children}
    </em>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-3 mb-3 rounded-r border-l-4 border-blue-500 bg-blue-50 py-2 pl-4 text-slate-700 italic first:mt-0 dark:bg-blue-900/20 dark:text-slate-300">
      {children}
    </blockquote>
  ),
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown components={MARKDOWN_COMPONENTS}>{content}</ReactMarkdown>
    </div>
  )
}
