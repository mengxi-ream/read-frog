import type { TextItem } from "pdfjs-dist/types/src/display/api"
import {
  IconChevronLeft,
  IconChevronRight,
  IconZoomIn,
  IconZoomOut,
  IconZoomScan,
} from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { GlobalWorkerOptions } from "pdfjs-dist"
import { type PDFDocumentProxy, type RenderTask, getDocument } from "pdfjs-dist"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Card } from "@/components/ui/base-ui/card"
import { Separator } from "@/components/ui/base-ui/separator"
import { Spinner } from "@/components/ui/base-ui/spinner"
import { configAtom } from "@/utils/atoms/config"
import { getProviderConfigById } from "@/utils/config/helpers"
import { Sha256Hex } from "@/utils/hash"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"

// Use the bundled worker. WXT/Vite resolves this at build time.
GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString()

interface TextBlock {
  id: string
  text: string
  page: number
}

interface TranslatedBlock extends TextBlock {
  translation: string
  status: "pending" | "translating" | "done" | "error"
}

const BASE_SCALE = 1.5
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3.0
const ZOOM_STEP = 0.25

export default function PdfViewerApp() {
  const config = useAtomValue(configAtom)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [textBlocks, setTextBlocks] = useState<TextBlock[]>([])
  const [translations, setTranslations] = useState<Map<string, TranslatedBlock>>(new Map())
  const [translating, setTranslating] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [fitMode, setFitMode] = useState<"fit" | "manual">("fit")
  const renderTaskRef = useRef<RenderTask | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const canvasContainerRef = useRef<HTMLDivElement | null>(null)
  // Track which pages have been translated so we don't re-translate on re-renders
  const translatedPagesRef = useRef<Set<number>>(new Set())

  // Parse the PDF URL from query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const url = params.get("url")
    if (!url) {
      setError("No PDF URL provided. Use ?url=<pdf-url>")
      setLoading(false)
      return
    }
    setPdfUrl(url)
  }, [])

  // Load the PDF document
  useEffect(() => {
    if (!pdfUrl) {
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const response = await fetch(pdfUrl, { credentials: "include" })
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
        }
        if (cancelled) return

        const arrayBuffer = await response.arrayBuffer()
        if (cancelled) return

        const bytes = new Uint8Array(arrayBuffer)
        const doc = await getDocument({ data: bytes }).promise
        if (cancelled) return

        setPdfDoc(doc)
        setNumPages(doc.numPages)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        logger.error("Failed to load PDF", err)
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pdfUrl])

  // Compute the fit-to-width scale for the current container width
  const computeFitScale = useCallback((pageWidth: number): number => {
    if (!canvasContainerRef.current) return BASE_SCALE
    const containerWidth = canvasContainerRef.current.clientWidth - 32 // padding
    if (containerWidth <= 0) return BASE_SCALE
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, containerWidth / pageWidth))
  }, [])

  // Render the current page and extract text in reading order
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || !canvasRef.current) return

      const page = await pdfDoc.getPage(pageNum)
      const baseViewport = page.getViewport({ scale: 1 })

      // Determine the effective scale
      let effectiveScale = BASE_SCALE * zoom
      if (fitMode === "fit") {
        const fitScale = computeFitScale(baseViewport.width)
        effectiveScale = fitScale
      }

      const viewport = page.getViewport({ scale: effectiveScale })

      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")!
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`

      renderTaskRef.current?.cancel()
      renderTaskRef.current = page.render({ canvas: canvas, canvasContext: ctx, viewport })
      await renderTaskRef.current.promise.then(() => undefined).catch(() => {})

      // Extract text content. PDF.js returns items in layout order, which for
      // multi-column PDFs mixes columns. We need to:
      // 1. Group items into lines (same Y, contiguous X)
      // 2. Detect columns by X clustering
      // 3. Sort lines in reading order (left column top-to-bottom, then right)
      const textContent = await page.getTextContent()

      // Step 1: Build raw line segments — group items by Y proximity AND X contiguity
      // Items on the same Y but in different columns become separate lines.
      interface RawLine {
        text: string
        x: number
        y: number
        width: number
        height: number
      }
      const rawLines: RawLine[] = []

      for (const item of textContent.items) {
        const textItem = item as TextItem
        if (!("str" in textItem) || !textItem.str) continue

        const tx = textItem.transform[4]
        const ty = textItem.transform[5]
        const cssY = viewport.height - ty
        const itemHeight = textItem.height || textItem.transform[0] * 10
        const itemWidth = textItem.width || 0
        const text = textItem.str

        // Find an existing line on the same Y (within tolerance) AND contiguous X.
        // X contiguity is strict: the item must start within a small gap of where
        // the existing line ends. This prevents merging text from different columns.
        const candidate = rawLines.find(
          (line) =>
            Math.abs(line.y - cssY) < itemHeight * 0.5 &&
            // Item X must be near the line's end X (within 1 character width)
            tx >= line.x - itemHeight &&
            tx <= line.x + line.width + itemHeight * 1.5,
        )

        if (candidate) {
          // Append to existing line
          candidate.text += text
          candidate.width = Math.max(candidate.width, tx + itemWidth - candidate.x)
        } else {
          // New line
          rawLines.push({
            text,
            x: tx,
            y: cssY,
            width: itemWidth,
            height: itemHeight,
          })
        }
      }

      // Trim line texts
      for (const line of rawLines) {
        line.text = line.text.trim()
      }

      // Detect multi-column layout. PDF.js returns text items in layout order,
      // which for two-column PDFs interleaves items from both columns at the same Y.
      // We detect columns by finding two distinct X clusters among lines that share
      // the same Y position.
      //
      // Algorithm:
      // 1. Group lines by Y proximity (lines at the same vertical position)
      // 2. For each Y-group, check if lines form distinct X clusters
      // 3. If many Y-groups have 2 X clusters, it's a two-column layout
      // 4. Find the column boundary X value

      // Find the typical line height to use as Y tolerance
      const heights = rawLines.map((l) => l.height).filter((h) => h > 0)
      const typicalHeight =
        heights.length > 0 ? heights.sort((a, b) => a - b)[Math.floor(heights.length / 2)] : 12

      // Group lines by Y proximity
      const yGroups: Array<{ y: number; lines: typeof rawLines }> = []
      for (const line of [...rawLines].sort((a, b) => a.y - b.y)) {
        const group = yGroups.find((g) => Math.abs(g.y - line.y) < typicalHeight * 0.5)
        if (group) {
          group.lines.push(line)
        } else {
          yGroups.push({ y: line.y, lines: [line] })
        }
      }

      // For Y-groups with 2+ lines, find the X gap that separates them
      // The column boundary is the midpoint of the largest X gap within Y-groups
      const gapCandidates: number[] = []
      for (const group of yGroups) {
        if (group.lines.length < 2) continue
        const sortedByX = [...group.lines].sort((a, b) => a.x - b.x)
        for (let i = 1; i < sortedByX.length; i++) {
          const gap = sortedByX[i].x - (sortedByX[i - 1].x + sortedByX[i - 1].width)
          // Gap must be significant (at least 3x typical height) to be a column separator
          if (gap > typicalHeight * 3) {
            gapCandidates.push(sortedByX[i - 1].x + sortedByX[i - 1].width + gap / 2)
          }
        }
      }

      // If we found enough column boundaries, it's two-column
      const isTwoColumn = gapCandidates.length > 5
      const columnBoundary = isTwoColumn
        ? gapCandidates.sort((a, b) => a - b)[Math.floor(gapCandidates.length / 2)]
        : 0

      // Assign lines to columns and sort in reading order
      let sortedLines: typeof rawLines
      if (isTwoColumn) {
        const leftLines = rawLines.filter((l) => l.x + l.width / 2 < columnBoundary)
        const rightLines = rawLines.filter((l) => l.x + l.width / 2 >= columnBoundary)
        const left = leftLines.sort((a, b) => a.y - b.y)
        const right = rightLines.sort((a, b) => a.y - b.y)
        sortedLines = [...left, ...right]
      } else {
        sortedLines = [...rawLines].sort((a, b) => a.y - b.y)
      }

      // Group lines into paragraphs. A new paragraph starts when:
      // - There's a vertical gap larger than 0.8x the previous line height
      // - The previous line ended with sentence punctuation AND the next starts
      //   with a capital letter (likely a new paragraph, not a continuation)
      // - The line is significantly indented compared to the previous one
      const paragraphs: string[] = []
      let currentPara = ""
      let prevLineHeight = 0
      let prevY = 0
      let prevX = -1

      for (const line of sortedLines) {
        // Skip very short lines (single chars, symbols, page numbers)
        if (line.text.length < 2 && !/[a-zA-Z]/.test(line.text)) continue

        if (currentPara === "") {
          currentPara = line.text
        } else {
          const gap = Math.abs(line.y - prevY)
          const lineGap = gap - prevLineHeight
          const isLargeGap = lineGap > prevLineHeight * 0.8
          const prevEndsSentence = /[.!?:;]$/.test(currentPara.trim())
          const startsNewSection = /^[A-Z(]/.test(line.text) && prevEndsSentence
          // Detect significant indentation change (new paragraph or section)
          const indentChange = Math.abs(line.x - prevX) > prevLineHeight * 3

          if (isLargeGap || startsNewSection || indentChange) {
            if (currentPara.trim()) paragraphs.push(currentPara.trim())
            currentPara = line.text
          } else {
            currentPara += " " + line.text
          }
        }
        prevY = line.y
        prevLineHeight = line.height
        prevX = line.x
      }
      if (currentPara.trim()) paragraphs.push(currentPara.trim())

      const blocks: TextBlock[] = paragraphs.map((text, i) => ({
        id: `p${pageNum}-para${i}`,
        text,
        page: pageNum,
      }))

      // Only clear translations if this is a different page than what we already have.
      // Zoom changes re-render the page but shouldn't clear existing translations.
      setTextBlocks((prev) => {
        if (prev.length > 0 && prev[0]?.page === pageNum) {
          // Same page — keep existing translations, just update blocks (text is same)
          return prev
        }
        // New page — clear translations and set new blocks
        setTranslations(new Map())
        return blocks
      })
    },
    [pdfDoc, zoom, fitMode, computeFitScale],
  )

  // Translate all text blocks on a page (auto-triggered on page change)
  const translatePageBlocks = useCallback(
    async (blocks: TextBlock[], pageNum: number) => {
      if (blocks.length === 0) return
      // Skip if already translated
      if (translatedPagesRef.current.has(pageNum)) return

      const providerConfig = getProviderConfigById(
        config.providersConfig,
        config.translate.providerId,
      )
      if (!providerConfig) {
        setError("No translation provider configured")
        return
      }

      translatedPagesRef.current.add(pageNum)
      setTranslating(true)

      const newTranslations = new Map<string, TranslatedBlock>()
      for (const block of blocks) {
        newTranslations.set(block.id, { ...block, translation: "", status: "pending" })
      }
      setTranslations(new Map(newTranslations))

      for (const block of blocks) {
        // Skip very short blocks (single names, symbols, page numbers)
        // — don't show a translation for these
        if (block.text.length < 10) {
          newTranslations.set(block.id, { ...block, translation: "", status: "done" })
          setTranslations(new Map(newTranslations))
          continue
        }
        try {
          newTranslations.set(block.id, { ...block, translation: "", status: "translating" })
          setTranslations(new Map(newTranslations))

          const hash = Sha256Hex(
            block.text,
            config.language.sourceCode,
            config.language.targetCode,
            providerConfig.id,
          )

          const result = await sendMessage("enqueueTranslateRequest", {
            text: block.text,
            langConfig: config.language,
            providerConfig,
            scheduleAt: Date.now(),
            hash,
          })

          if (typeof result === "string") {
            newTranslations.set(block.id, {
              ...block,
              translation: result,
              status: "done",
            })
          } else {
            newTranslations.set(block.id, { ...block, translation: "", status: "error" })
          }
          setTranslations(new Map(newTranslations))
        } catch (err) {
          logger.error("Translation failed for block", block.id, err)
          newTranslations.set(block.id, { ...block, translation: "", status: "error" })
          setTranslations(new Map(newTranslations))
        }
      }

      setTranslating(false)
    },
    [config],
  )

  // Render page when page or zoom changes
  useEffect(() => {
    if (pdfDoc && !loading) {
      void renderPage(currentPage)
    }
  }, [pdfDoc, currentPage, loading, renderPage])

  // Re-render on window resize when in fit mode
  useEffect(() => {
    if (fitMode !== "fit") return undefined
    const handleResize = () => void renderPage(currentPage)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [fitMode, currentPage, renderPage])

  // Zoom handlers
  const zoomIn = useCallback(() => {
    setFitMode("manual")
    setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))
  }, [])
  const zoomOut = useCallback(() => {
    setFitMode("manual")
    setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))
  }, [])
  const zoomFit = useCallback(() => {
    setFitMode("fit")
    setZoom(1)
  }, [])

  // Translation progress
  const translationProgress = (() => {
    if (textBlocks.length === 0) return 0
    const done = Array.from(translations.values()).filter(
      (t) => t.status === "done" || t.status === "error",
    ).length
    return Math.round((done / textBlocks.length) * 100)
  })()

  // Auto-translate when text blocks are extracted for a new page
  useEffect(() => {
    if (textBlocks.length > 0 && !translatedPagesRef.current.has(currentPage)) {
      void translatePageBlocks(textBlocks, currentPage)
    }
  }, [textBlocks, currentPage, translatePageBlocks])

  if (loading) {
    return (
      <div className="flex h-screen animate-in items-center justify-center bg-background duration-200 fade-in">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Spinner className="size-6" />
          <p className="text-sm">Loading PDF…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen animate-in items-center justify-center bg-background duration-200 fade-in">
        <Card size="sm" className="max-w-md p-6 text-center">
          <p className="text-sm font-medium text-destructive">{error}</p>
          {pdfUrl && <p className="mt-2 text-xs break-all text-muted-foreground">{pdfUrl}</p>}
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-muted">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-2 shadow-sm">
        {/* Page navigation */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
        >
          <IconChevronLeft className="size-4" />
        </Button>
        <span className="min-w-25 text-center text-sm text-muted-foreground tabular-nums">
          {currentPage} / {numPages}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
          disabled={currentPage >= numPages}
        >
          <IconChevronRight className="size-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* Zoom controls */}
        <Button variant="ghost" size="icon-sm" onClick={zoomOut} disabled={zoom <= MIN_ZOOM}>
          <IconZoomOut className="size-4" />
        </Button>
        <button
          type="button"
          onClick={zoomFit}
          className="min-w-15 rounded px-2 py-1 text-xs text-muted-foreground tabular-nums transition-transform hover:bg-muted active:scale-95"
          title="Fit to width"
        >
          {fitMode === "fit" ? "Fit" : `${Math.round(zoom * 100)}%`}
        </button>
        <Button variant="ghost" size="icon-sm" onClick={zoomIn} disabled={zoom >= MAX_ZOOM}>
          <IconZoomIn className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={zoomFit}
          title="Fit to width"
          className={fitMode === "fit" ? "text-brand" : ""}
        >
          <IconZoomScan className="size-4" />
        </Button>

        {/* Translation progress */}
        {translating && (
          <div className="ml-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-3" />
            <span>Translating… {translationProgress}%</span>
          </div>
        )}
      </div>

      {/* Side-by-side: PDF on left, translations on right */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF canvas (left) */}
        <div ref={canvasContainerRef} className="flex-1 overflow-auto bg-muted p-4">
          <div className="mx-auto inline-block rounded-lg bg-background shadow-md ring-1 ring-foreground/5 transition-opacity duration-100">
            <canvas ref={canvasRef} className="block" />
          </div>
        </div>

        {/* Translation panel (right) */}
        <div className="w-105 shrink-0 overflow-x-hidden overflow-y-auto border-l border-border bg-background">
          {textBlocks.length === 0 ? (
            <div className="flex h-full items-center justify-center p-4">
              <p className="text-sm text-muted-foreground">No text detected on this page.</p>
            </div>
          ) : (
            <div className="space-y-0 p-3">
              {/* Progress bar at top of panel */}
              {translating && (
                <div className="sticky top-0 -mx-3 mb-2 bg-background px-3 py-2">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full origin-left bg-brand transition-[width] duration-300 ease-out"
                      style={{ width: `${translationProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {textBlocks.map((block, idx) => {
                const translated = translations.get(block.id)
                return (
                  <div
                    key={block.id}
                    className="animate-in duration-200 fade-in"
                    style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
                  >
                    {idx > 0 && <Separator className="opacity-60" />}
                    <div className="py-3">
                      {/* Original text */}
                      <p className="text-sm leading-snug break-words hyphens-auto text-muted-foreground">
                        {block.text}
                      </p>
                      {/* Translation */}
                      {translated?.status === "translating" && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Spinner className="size-3" />
                          <span>Translating…</span>
                        </div>
                      )}
                      {translated?.status === "done" && translated.translation && (
                        <p className="mt-1.5 animate-in text-sm leading-snug break-words hyphens-auto text-foreground duration-200 fade-in">
                          {translated.translation}
                        </p>
                      )}
                      {translated?.status === "error" && (
                        <p className="mt-1.5 text-xs text-destructive italic">Translation failed</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
