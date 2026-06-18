import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ReactMarkdown from "react-markdown";
export function MarkdownRenderer({ content, className = "" }) {
    return (_jsx("div", { className: `markdown-content ${className}`, children: _jsx(ReactMarkdown, { components: {
                h1: ({ children }) => (_jsxs("h1", { className: "text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 mt-6 first:mt-0 pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center", children: [_jsx("span", { className: "w-2 h-2 bg-blue-500 rounded-full mr-3" }), children] })),
                h2: ({ children }) => (_jsxs("h2", { className: "text-base font-semibold text-slate-800 dark:text-slate-100 mb-3 mt-5 first:mt-0 flex items-center", children: [_jsx("span", { className: "w-1.5 h-1.5 bg-green-500 rounded-full mr-2" }), children] })),
                h3: ({ children }) => (_jsxs("h3", { className: "text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2 mt-4 first:mt-0 flex items-center", children: [_jsx("span", { className: "w-1 h-1 bg-orange-500 rounded-full mr-2" }), children] })),
                h4: ({ children }) => (_jsxs("h4", { className: "text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2 mt-4 first:mt-0 flex items-center", children: [_jsx("span", { className: "w-1 h-1 bg-purple-500 rounded-full mr-2" }), children] })),
                p: ({ children }) => (_jsx("p", { className: "text-sm text-slate-700 dark:text-slate-300 mb-3 mt-3 first:mt-0 leading-relaxed", children: children })),
                ul: ({ children }) => (_jsx("ul", { className: "mb-3 mt-3 first:mt-0 space-y-2", children: children })),
                ol: ({ children }) => (_jsx("ol", { className: "mb-3 mt-3 first:mt-0 space-y-2", children: children })),
                li: ({ children }) => (_jsxs("li", { className: "text-sm text-slate-700 dark:text-slate-300 flex items-start", children: [_jsx("span", { className: "w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full mt-2 mr-3 flex-shrink-0" }), _jsx("span", { className: "flex-1", children: children })] })),
                strong: ({ children }) => (_jsx("strong", { className: "font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded", children: children })),
                em: ({ children }) => (_jsx("em", { className: "italic text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-1 py-0.5 rounded", children: children })),
                blockquote: ({ children }) => (_jsx("blockquote", { className: "border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 pl-4 py-2 mb-3 mt-3 first:mt-0 italic text-slate-700 dark:text-slate-300 rounded-r", children: children })),
            }, children: content }) }));
}
