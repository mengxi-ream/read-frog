import type { HighlightState } from '@/types/highlight'
import { kebabCase } from 'case-anything'
import { Clipboard, Database, FileText, Highlighter, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAnki } from '@/hooks/useAnki'
import { useHighlighter } from '@/hooks/useHighlighter'
import { APP_NAME } from '@/utils/constants/app'
import { COLOR_OPTIONS } from '@/utils/highlight'

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

interface HighlighterSectionProps {
  className?: string
}

export function HighlighterSection({ className }: HighlighterSectionProps) {
  const {
    isActive,
    highlights,
    highlightColor,
    conflictMessage,
    highlightData,
    isExporting,
    isImporting,
    isGenerating,
    createHighlight,
    removeHighlight,
    removeAllHighlights,
    changeHighlightColor,
    toggleActive,
    setConflictMessage,
    copyPrompt,
    importExplanationsFromClipboard,
    generateExplanations,
    getHighlightData,
  } = useHighlighter({
    enabled: true,
    containerSelector: 'body',
  })

  const [showExplanations, setShowExplanations] = useState(true)

  // Anki integration
  const {
    isExporting: isExportingToAnki,
    exportHighlightsWithExplanations,
  } = useAnki()

  // 处理复制 Prompt
  const handleCopyPrompt = async () => {
    try {
      await copyPrompt()
      toast.success('Prompt copied to clipboard!')
    }
    catch (error) {
      toast.error(`Copy failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // 处理从剪贴板导入解释
  const handleImportFromClipboard = async () => {
    try {
      const count = await importExplanationsFromClipboard()
      toast.success(`Successfully imported ${count} explanations from clipboard!`)
      // 刷新数据显示
      await getHighlightData()
    }
    catch (error) {
      toast.error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // 处理生成解释
  const handleGenerateExplanations = async () => {
    try {
      const count = await generateExplanations()
      toast.success(`Successfully generated explanations for ${count} highlights!`)
      // 刷新数据显示
      await getHighlightData()
    }
    catch (error) {
      toast.error(`Generate explanations failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // 处理导出到 Anki
  const handleExportToAnki = async () => {
    try {
      const result = await exportHighlightsWithExplanations()
      toast.success(`Successfully exported ${result.added} cards to Anki! Exported highlights have been removed.`)

      // 移除已导出的高亮
      if (result.exportedHighlightIds && result.exportedHighlightIds.length > 0) {
        result.exportedHighlightIds.forEach((highlightId) => {
          removeHighlight(highlightId)
        })
        // 刷新数据显示
        await getHighlightData()
      }
    }
    catch (error) {
      toast.error(`Anki export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // 加载解释数据
  useEffect(() => {
    if (isActive && highlights.length > 0) {
      getHighlightData()
    }
  }, [isActive, highlights.length, getHighlightData])

  // 滚动到高亮位置
  const scrollToHighlight = (highlight: HighlightState) => {
    const element = highlight.element
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      })

      // 获取所有需要高亮的元素（包括segments）
      const elementsToHighlight = highlight.segments && highlight.segments.length > 0
        ? highlight.segments
        : [element]

      // 添加临时高亮效果到所有元素
      elementsToHighlight.forEach((el) => {
        el.style.boxShadow = '0 0 8px rgba(59, 130, 246, 0.5)'
        el.style.transition = 'box-shadow 0.3s ease'
      })

      setTimeout(() => {
        elementsToHighlight.forEach((el) => {
          el.style.boxShadow = ''
          el.style.transition = ''
        })
      }, 2000)
    }
  }

  // 监听文本选择事件
  useEffect(() => {
    if (!isActive)
      return

    const handleMouseUp = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // 排除扩展自身的shadow root
      if (target.closest('[data-wxt-shadow-root]')
        || target.closest(`[id*="${kebabCase(APP_NAME)}"]`)) {
        return
      }

      const selection = window.getSelection()
      if (!selection || selection.isCollapsed)
        return

      const range = selection.getRangeAt(0)
      const selectedText = range.toString().trim()
      if (selectedText) {
        createHighlight(range, selectedText)
        selection.removeAllRanges()
      }
    }

    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isActive, createHighlight])

  return (
    <div className={cn('border-b border-border', className)}>
      {/* Header */}
      <div className="flex w-full items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <Highlighter size={16} className="text-blue-500" />
          <span className="text-sm font-medium">Text Highlighter</span>
          {highlights.length > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
              {highlights.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {highlights.length > 0 && (
            <button
              type="button"
              onClick={removeAllHighlights}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 size={12} />
              Clear All
            </button>
          )}
          <button
            type="button"
            onClick={() => toggleActive()}
            className={cn(
              'px-2 py-1 text-xs font-medium rounded transition-colors',
              isActive
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {isActive ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pb-3 space-y-3">
        {/* Conflict Message */}
        {conflictMessage && (
          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <div className="flex items-center justify-between">
              <span className="text-yellow-800">
                ⚠️
                {conflictMessage}
              </span>
              <button
                type="button"
                onClick={() => setConflictMessage('')}
                className="text-yellow-600 hover:text-yellow-800"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {isActive && (
          <>
            {/* Color Picker */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Colors</h4>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_OPTIONS.map(({ color, name }) => (
                  <button
                    type="button"
                    key={color}
                    onClick={() => changeHighlightColor(color)}
                    title={name}
                    className={cn(
                      'w-6 h-6 rounded border-2 transition-all hover:scale-110',
                      highlightColor === color
                        ? 'border-gray-600 ring-1 ring-gray-300'
                        : 'border-gray-300 hover:border-gray-400',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Highlights List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-muted-foreground">
                  Highlights (
                  {highlights.length}
                  )
                </h4>
                {highlights.length > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowExplanations(!showExplanations)}
                      className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                      title="Toggle explanations view"
                    >
                      {showExplanations ? 'Hide' : 'Show'}
                      {' '}
                      Explanations
                    </button>
                  </div>
                )}
              </div>
              {highlights.length > 0
                ? (
                    <div className="space-y-1.5 overflow-y-auto max-h-120">
                      {highlights.map((highlight) => {
                        const data = highlightData.find(d => d.id === highlight.id)
                        return (
                          <div
                            key={highlight.id}
                            className="p-2 bg-muted/50 rounded text-xs group"
                          >
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => scrollToHighlight(highlight)}
                                className="flex-1 truncate text-left hover:text-blue-600 transition-colors cursor-pointer"
                                title="Click to jump to highlight"
                              >
                                "
                                {highlight.text.length > 30 ? `${highlight.text.substring(0, 30)}...` : highlight.text}
                                "
                              </button>
                              <button
                                type="button"
                                onClick={() => removeHighlight(highlight.id)}
                                className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove highlight"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            {showExplanations && data?.explanation && (
                              <div className="mt-2 p-2 bg-white/80 rounded border border-gray-200">
                                <div className="text-xs text-gray-700 mb-1">
                                  <strong>Explanation:</strong>
                                  {' '}
                                  {data.explanation}
                                </div>
                                {data.examples && data.examples.length > 0 && (
                                  <div className="text-xs text-gray-600 mb-1">
                                    <strong>Examples:</strong>
                                    <ul className="list-disc list-inside ml-2 mt-1">
                                      {data.examples.slice(0, 2).map((example, idx) => (
                                        <li key={idx}>{example}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {data.pronunciation && (
                                  <div className="text-xs text-gray-600">
                                    <strong>Pronunciation:</strong>
                                    {' '}
                                    {data.pronunciation}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                : (
                    <p className="text-xs text-muted-foreground italic py-2">
                      Select text on the page to highlight
                    </p>
                  )}
            </div>

            {/* Export/Import Section */}
            {highlights.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">AI Explanations</h4>
                <div className="space-y-2">
                  {/* Copy Buttons */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      disabled={isExporting}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                      title="Copy AI prompt to clipboard for generating explanations"
                    >
                      <FileText size={12} />
                      {isExporting ? 'Copying...' : 'Copy Prompt'}
                    </button>
                    <button
                      type="button"
                      onClick={handleImportFromClipboard}
                      disabled={isImporting}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                      title="Import AI explanations from clipboard"
                    >
                      <Clipboard size={12} />
                      {isImporting ? 'Importing...' : 'Import from Clipboard'}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateExplanations}
                      disabled={isGenerating}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                      title="Generate explanations using configured AI model"
                    >
                      <Sparkles size={12} />
                      {isGenerating ? 'Generating...' : 'Generate Explanations'}
                    </button>

                    <button
                      type="button"
                      onClick={handleExportToAnki}
                      disabled={isExportingToAnki}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                      title="Export highlights with explanations to Anki"
                    >
                      <Database size={12} />
                      {isExportingToAnki ? 'Exporting...' : 'Export to Anki'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
              💡 Select text to highlight. Click highlighted text to jump to its location.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
