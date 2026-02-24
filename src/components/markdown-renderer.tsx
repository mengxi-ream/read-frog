import ReactMarkdown from "react-markdown"

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 mt-6 first:mt-0 pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-3 mt-5 first:mt-0 flex items-center">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2 mt-4 first:mt-0 flex items-center">
              <span className="w-1 h-1 bg-orange-500 rounded-full mr-2"></span>
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2 mt-4 first:mt-0 flex items-center">
              <span className="w-1 h-1 bg-purple-500 rounded-full mr-2"></span>
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-3 mt-3 first:mt-0 leading-relaxed">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 mt-3 first:mt-0 space-y-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 mt-3 first:mt-0 space-y-2">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-sm text-slate-700 dark:text-slate-300 flex items-start">
              <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              <span className="flex-1">{children}</span>
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-1 py-0.5 rounded">
              {children}
            </em>
          ),

          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 pl-4 py-2 mb-3 mt-3 first:mt-0 italic text-slate-700 dark:text-slate-300 rounded-r">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
