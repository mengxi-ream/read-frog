import {
  Select as UISelect,
  SelectContent as UISelectContent,
  SelectGroup as UISelectGroup,
  SelectItem as UISelectItem,
  SelectLabel as UISelectLabel,
  SelectTrigger as UISelectTrigger,
  SelectValue as UISelectValue,
} from '@repo/ui/components/select'
import * as React from 'react'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent)

type V = string
interface ContextType {
  open: boolean
  setOpen: (b: boolean) => void
  value: V | undefined
  setValue: (v: V) => void
  onValueChange?: (v: V) => void
  triggerRef: React.RefObject<HTMLElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
  listboxId: string
  items: { el: HTMLElement, value: V }[]
  registerItem: (el: HTMLElement, v: V) => void
  unregisterItem: (v: V) => void
  highlightedIndex: number
  setHighlightedIndex: (i: number) => void
  disabled?: boolean
  placeholder?: React.ReactNode
  setItemPreview: (v: V, node: React.ReactNode) => void
  getItemPreview: (v?: V) => React.ReactNode | undefined
}

const Ctx = React.createContext<ContextType | null>(null)
function useCtx() {
  const c = React.use(Ctx)
  if (!c)
    throw new Error('Select.* must be used within <Select.Root>')
  return c
}

const ItemCtx = React.createContext<{ value: V } | null>(null)
function useItem() {
  const c = React.use(ItemCtx)
  if (!c)
    throw new Error('Select.ItemText must be used within Select.Item')
  return c
}

function Root({
  children,
  value: cv,
  defaultValue,
  onValueChange,
  open: co,
  onOpenChange,
  disabled,
}: React.PropsWithChildren<{
  value?: V
  defaultValue?: V
  onValueChange?: (v: V) => void
  open?: boolean
  onOpenChange?: (o: boolean) => void
  disabled?: boolean
}>) {
  const [uv, setUv] = useState<V | undefined>(defaultValue)
  const value = cv ?? uv
  const setValue = useCallback((v: V) => {
    onValueChange?.(v)
    if (cv === undefined)
      setUv(v)
  }, [cv, onValueChange])

  const [uo, setUo] = useState(false)
  const open = co ?? uo
  const setOpen = useCallback((o: boolean) => {
    onOpenChange?.(o)
    if (co === undefined)
      setUo(o)
  }, [co, onOpenChange])

  const triggerRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const itemsRef = useRef<{ el: HTMLElement, value: V }[]>([])

  const previewsRef = useRef<Map<V, React.ReactNode>>(new Map())

  const registerItem = useCallback((el: HTMLElement, v: V) => {
    const existing = itemsRef.current.findIndex(item => item.value === v)
    if (existing >= 0) {
      itemsRef.current[existing] = { el, value: v }
    }
    else {
      itemsRef.current.push({ el, value: v })
    }
  }, [])

  const unregisterItem = useCallback((v: V) => {
    itemsRef.current = itemsRef.current.filter(i => i.value !== v)
    previewsRef.current.delete(v)
  }, [])

  const setItemPreview = useCallback((v: V, node: React.ReactNode) => {
    previewsRef.current.set(v, node)
  }, [])

  const getItemPreview = useCallback((v?: V) => {
    if (!v)
      return undefined
    return previewsRef.current.get(v)
  }, [])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const listboxId = useId()

  useEffect(() => {
    if (!open)
      return
    const onPD = (e: PointerEvent) => {
      const t = e.target as Node | null
      if (t && (triggerRef.current?.contains(t) || contentRef.current?.contains(t)))
        return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPD, true)
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape')
        setOpen(false)
    }
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('pointerdown', onPD, true)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open, setOpen])

  const ctx = useMemo<ContextType>(() => ({
    open,
    setOpen,
    value,
    setValue,
    onValueChange,
    triggerRef,
    contentRef,
    listboxId,
    items: itemsRef.current,
    registerItem,
    unregisterItem,
    highlightedIndex,
    setHighlightedIndex,
    disabled,
    setItemPreview,
    getItemPreview,
  }), [open, value, disabled, highlightedIndex, registerItem, unregisterItem, setValue, setItemPreview, getItemPreview, onValueChange, listboxId, setOpen])

  return <Ctx value={ctx}>{children}</Ctx>
}

function Trigger({ ref, className, disabled, children, size = 'default', hideChevron = false }: React.PropsWithChildren<{
  className?: string
  disabled?: boolean
  placeholder?: React.ReactNode
  size?: 'sm' | 'default'
  hideChevron?: boolean
}> & { ref?: React.RefObject<HTMLElement | null> }) {
  const { open, setOpen, value, triggerRef, contentRef, items, setHighlightedIndex } = useCtx()
  const setRefs = useCallback((node: HTMLElement | null) => {
    triggerRef.current = node
    if (ref && typeof ref === 'object' && 'current' in ref) {
      (ref as React.MutableRefObject<HTMLElement | null>).current = node
    }
  }, [ref, triggerRef])

  const openAndFocus = () => {
    if (open)
      return
    setOpen(true)
    const idx = items.findIndex(i => i.value === value)
    setHighlightedIndex(idx >= 0 ? idx : 0)
    queueMicrotask(() => contentRef.current?.focus())
  }

  const baseClasses = `border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`
  const sizeClasses = size === 'sm' ? 'h-9' : 'h-10'
  const combinedClassName = `${baseClasses} ${sizeClasses} ${className || ''}`

  return (
    <button
      ref={setRefs as any}
      type="button"
      className={combinedClassName}
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      data-slot="select-trigger"
      data-size={size}
      data-state={open ? 'open' : 'closed'}
      onClick={() => {
        if (disabled)
          return
        open ? setOpen(false) : openAndFocus()
      }}
      onKeyDown={(e) => {
        if (disabled)
          return
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
          e.preventDefault()
          openAndFocus()
        }
      }}
    >
      {children}
      {!hideChevron && (
        <span aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 opacity-50">
            <path d="m6 9 6 6 6-6"></path>
          </svg>
        </span>
      )}
    </button>
  )
}

const Value: React.FC<React.PropsWithChildren<{
  placeholder?: React.ReactNode
  asChild?: boolean
}>> = ({ children, placeholder, asChild }) => {
  const { value, getItemPreview } = useCtx()
  const preview = getItemPreview(value)

  const displayValue = preview ?? value ?? placeholder ?? <span style={{ opacity: 0.6 }}>—</span>

  // If asChild is true, use the child element but replace its content with the actual value
  if (asChild && React.isValidElement(children)) {
    const childProps = children.props as any
    return React.createElement(
      children.type as any,
      {
        ...childProps,
        'data-slot': 'select-value',
        'children': displayValue,
      },
    )
  }

  // If children are provided but asChild is false, use children
  if (children) {
    return (
      <span data-slot="select-value" className="flex items-center gap-2 min-w-0 flex-1">
        {children}
      </span>
    )
  }

  // Default case: display the value
  return (
    <span data-slot="select-value" className="flex items-center gap-2 min-w-0 flex-1 truncate">
      {displayValue}
    </span>
  )
}

const Portal: React.FC<{
  container?: HTMLElement | null
  children: React.ReactNode
}> = ({ container, children }) => {
  if (typeof document === 'undefined')
    return null
  return createPortal(children, container ?? document.body)
}

const ScrollUpButton: React.FC<{ className?: string }> = ({ className }) => {
  const [canScrollUp, setCanScrollUp] = useState(false)
  const { contentRef } = useCtx()

  const checkScroll = useCallback(() => {
    const el = contentRef.current?.querySelector('.select-scroll-container') as HTMLElement
    if (el) {
      const canScroll = el.scrollTop > 0
      setCanScrollUp(canScroll)
    }
  }, [contentRef])

  useEffect(() => {
    const el = contentRef.current?.querySelector('.select-scroll-container') as HTMLElement
    if (el) {
      el.addEventListener('scroll', checkScroll)

      const resizeObserver = new ResizeObserver(() => {
        checkScroll()
      })
      resizeObserver.observe(el)

      return () => {
        el.removeEventListener('scroll', checkScroll)
        resizeObserver.disconnect()
      }
    }
  }, [contentRef, checkScroll])

  useLayoutEffect(() => {
    const timeoutId = setTimeout(checkScroll, 10)
    return () => clearTimeout(timeoutId)
  }, [checkScroll])

  if (!canScrollUp)
    return null

  return (
    <div
      className={`flex cursor-default items-center justify-center py-1 ${className || ''}`}
      data-slot="select-scroll-up-button"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
        <path d="m18 15-6-6-6 6"></path>
      </svg>
    </div>
  )
}

const ScrollDownButton: React.FC<{ className?: string }> = ({ className }) => {
  const [canScrollDown, setCanScrollDown] = useState(true)
  const { contentRef } = useCtx()

  const checkScroll = useCallback(() => {
    const el = contentRef.current?.querySelector('.select-scroll-container') as HTMLElement
    if (el) {
      const canScroll = el.scrollTop + el.clientHeight < el.scrollHeight
      setCanScrollDown(canScroll)
    }
  }, [contentRef])

  useEffect(() => {
    const el = contentRef.current?.querySelector('.select-scroll-container') as HTMLElement
    if (el) {
      el.addEventListener('scroll', checkScroll)

      const resizeObserver = new ResizeObserver(() => {
        checkScroll()
      })
      resizeObserver.observe(el)

      return () => {
        el.removeEventListener('scroll', checkScroll)
        resizeObserver.disconnect()
      }
    }
  }, [contentRef, checkScroll])

  useLayoutEffect(() => {
    const timeoutId = setTimeout(checkScroll, 10)
    return () => clearTimeout(timeoutId)
  }, [checkScroll])

  if (!canScrollDown)
    return null

  return (
    <div
      className={`flex cursor-default items-center justify-center py-1 ${className || ''}`}
      data-slot="select-scroll-down-button"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
        <path d="m6 9 6 6 6-6"></path>
      </svg>
    </div>
  )
}

function Content({ ref, className, style, position = 'popper', container, children }: React.PropsWithChildren<{
  className?: string
  style?: React.CSSProperties
  position?: 'popper' | 'item-aligned'
  container?: HTMLElement | null
}> & { ref?: React.RefObject<HTMLDivElement | null> }) {
  const { open, setOpen, triggerRef, contentRef, listboxId, items, highlightedIndex, setHighlightedIndex, setValue } = useCtx()
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node
    if (ref && typeof ref === 'object' && 'current' in ref) {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    }
  }, [ref, contentRef])

  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const compute = useCallback(() => {
    const t = triggerRef.current
    if (!t)
      return
    const r = t.getBoundingClientRect()
    const minWidth = Math.max(r.width, 200)
    const rightAlignedLeft = r.right + window.scrollX - minWidth
    const left = Math.max(4, rightAlignedLeft)

    setCoords({
      top: r.bottom + window.scrollY + 4,
      left,
      width: minWidth,
    })
  }, [triggerRef])

  useLayoutEffect(() => {
    if (!open)
      return
    compute()
    const ro = new ResizeObserver(compute)
    triggerRef.current && ro.observe(triggerRef.current)
    const onScroll = () => compute()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, compute, triggerRef])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const max = items.length - 1
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(Math.min(max, highlightedIndex + 1))
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(Math.max(0, highlightedIndex - 1))
    }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[highlightedIndex]) {
        setValue(items[highlightedIndex].value)
        setOpen(false)
      }
    }
    else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <div style={{ display: 'none' }} aria-hidden data-slot="select-content-hidden">
        <div className="p-1">{children}</div>
      </div>
    )
  }

  const baseClasses = `bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-hidden rounded-md border shadow-md`
  const popperClasses = position === 'popper'
    ? `data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1`
    : ''
  const containerClasses = container !== document.body ? 'z-[2147483647]' : ''
  const combinedClassName = `${baseClasses} ${popperClasses} ${containerClasses} ${className || ''}`

  const body = (
    <div
      ref={setRefs}
      role="listbox"
      id={listboxId}
      tabIndex={-1}
      className={combinedClassName}
      data-slot="select-content"
      data-state={open ? 'open' : 'closed'}
      data-side="bottom"
      style={{
        ...style,
        ...(position === 'popper'
          ? { position: 'absolute', top: coords.top, left: coords.left, minWidth: coords.width, maxHeight: 400 }
          : {}),
        display: 'flex',
        flexDirection: 'column',
      }}
      onKeyDown={onKeyDown}
    >
      <ScrollUpButton />
      <div
        className="p-1 select-scroll-container"
        style={{
          flex: 1,
          overflowY: 'auto',
          scrollbarWidth: 'none', /* Firefox */
          msOverflowStyle: 'none', /* IE and Edge */
        } as React.CSSProperties}
      >
        <style>
          {`
            .select-scroll-container::-webkit-scrollbar {
              display: none;
            }
          `}
        </style>
        {children}
      </div>
      <ScrollDownButton />
    </div>
  )
  return position === 'popper' ? <Portal container={container}>{body}</Portal> : body
}

const Viewport: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => (
  <div role="presentation" className={className}>{children}</div>
)

function Item({ ref, value, className, disabled, children }: React.PropsWithChildren<{
  value: V
  className?: string
  disabled?: boolean
}> & { ref?: React.RefObject<HTMLDivElement | null> }) {
  const { registerItem, unregisterItem, items, highlightedIndex, setHighlightedIndex, setValue, value: cur, setOpen, setItemPreview } = useCtx()
  const id = useId()
  const elRef = useRef<HTMLDivElement | null>(null)
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    elRef.current = node
    if (ref && typeof ref === 'object' && 'current' in ref) {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    }
  }, [ref])

  useEffect(() => {
    if (!elRef.current)
      return
    registerItem(elRef.current, value)
    setItemPreview(value, <>{children}</>)
    return () => unregisterItem(value)
  }, [registerItem, unregisterItem, setItemPreview, value, children])

  const idx = items.findIndex(i => i.value === value)
  const highlighted = idx === highlightedIndex
  const selected = cur === value

  const baseClasses = `hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2`
  const highlightClasses = highlighted ? 'bg-accent text-accent-foreground' : ''
  const combinedClassName = `${baseClasses} ${highlightClasses} ${className || ''}`

  return (
    <ItemCtx value={{ value }}>
      <div
        ref={setRefs}
        id={id}
        role="option"
        aria-selected={selected}
        data-highlighted={highlighted ? '' : undefined}
        data-state={selected ? 'checked' : 'unchecked'}
        data-disabled={disabled ? '' : undefined}
        data-slot="select-item"
        tabIndex={-1}
        className={combinedClassName}
        onMouseEnter={() => idx >= 0 && setHighlightedIndex(idx)}
        onClick={() => {
          if (disabled)
            return
          setValue(value)
          setOpen(false)
        }}
      >
        <span className="absolute right-2 flex size-3.5 items-center justify-center">
          {selected && (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
        </span>
        <span>{children}</span>
      </div>
    </ItemCtx>
  )
}

const ItemText: React.FC<React.PropsWithChildren<Record<string, never>>> = ({ children }) => {
  const { value } = useItem()
  const { setItemPreview } = useCtx()

  useEffect(() => {
    setItemPreview(value, <>{children}</>)
  }, [value, children, setItemPreview])

  return <span>{children}</span>
}
const Icon: React.FC<React.PropsWithChildren<Record<string, never>>> = ({ children }) => <span aria-hidden>{children ?? '▾'}</span>

function Group({ children, className, ...props }: any) {
  return (
    <div role="group" data-slot="select-group" className={className} {...props}>
      {children}
    </div>
  )
}

function Label({ children, className, ...props }: any) {
  return (
    <div
      role="presentation"
      data-slot="select-label"
      className={`text-muted-foreground px-2 py-1.5 text-xs ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  )
}

const Fallback = { Root, Trigger, Value, Content, Viewport, Item, ItemText, Portal, Icon, Group, Label } as const

// UI components adapter for non-Firefox browsers
const UIComponents = {
  Root: UISelect,
  Trigger: UISelectTrigger,
  Value: UISelectValue,
  Content: UISelectContent,
  Viewport: ({ children }: React.PropsWithChildren) => <>{children}</>, // ui/select handles viewport internally
  Item: UISelectItem,
  ItemText: ({ children }: React.PropsWithChildren) => <span>{children}</span>, // Simple wrapper for compatibility
  Portal: ({ children }: React.PropsWithChildren) => <>{children}</>, // ui/select handles portals internally
  Icon, // Keep the existing Icon component
  Group: UISelectGroup,
  Label: UISelectLabel,
} as const

const Impl = isFirefox ? Fallback : UIComponents

export const Select = Impl.Root
export const SelectTrigger = Impl.Trigger
export const SelectValue = Impl.Value
export const SelectContent = Impl.Content
export const SelectItem = Impl.Item
export const SelectItemText = Impl.ItemText
export const SelectGroup = Impl.Group
export const SelectLabel = Impl.Label
