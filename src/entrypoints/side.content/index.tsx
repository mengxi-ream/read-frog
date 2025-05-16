import type { Config } from '@/types/config/config'
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { kebabCase } from 'case-anything'
import { Provider as JotaiProvider } from 'jotai/react'

import { useHydrateAtoms } from 'jotai/utils'
import ReactDOM from 'react-dom/client'

import { toast } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { configAtom } from '@/utils/atoms/config'
import { APP_NAME } from '@/utils/constants/app'
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from '@/utils/constants/config'
import { addStyleToShadow, mirrorDynamicStyles } from '../../utils/styles'
import App from './app'
import { store } from './atoms'

import '@/assets/tailwind/text-small.css'
import '@/assets/tailwind/theme.css'
import '@/entrypoints/host.content/style.css'

// eslint-disable-next-line import/no-mutable-exports
export let shadowWrapper: HTMLElement | null = null

export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
    const ui = await createShadowRootUi(ctx, {
      name: kebabCase(APP_NAME),
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      onMount: (container, shadow, shadowHost) => {
        // Store shadow root reference
        const wrapper = document.createElement('div')
        wrapper.className = cn(
          'text-base antialiased font-sans z-[2147483647]',
          isDarkMode() && 'dark',
        )
        shadowWrapper = wrapper
        container.appendChild(wrapper)

        const root = ReactDOM.createRoot(wrapper)

        addStyleToShadow(shadow)
        mirrorDynamicStyles('#_goober', shadow)
        // mirrorDynamicStyles(
        //   "style[type='text/css']",
        //   shadow,
        //   ".with-scroll-bars-hidden22"
        // );

        protectShadowRoot(shadowHost, wrapper)

        const queryClient = new QueryClient({
          queryCache: new QueryCache({
            onError: (error, query) => {
              const errorDescription
                = query.meta?.errorDescription || 'Something went wrong'
              toast.error(`${errorDescription}: ${error.message}`)
            },
          }),
          mutationCache: new MutationCache({
            onError: (error, _variables, _context, mutation) => {
              const errorDescription
                = mutation.meta?.errorDescription || 'Something went wrong'
              toast.error(`${errorDescription}: ${error.message}`)
            },
          }),
        })

        const HydrateAtoms = ({
          initialValues,
          children,
        }: {
          initialValues: [[typeof configAtom, Config]]
          children: React.ReactNode
        }) => {
          useHydrateAtoms(initialValues)
          return children
        }

        sendMessage('uploadIsPageTranslated', {
          isPageTranslated: false,
        })

        root.render(
          <QueryClientProvider client={queryClient}>
            <JotaiProvider store={store}>
              <HydrateAtoms
                initialValues={[[configAtom, config ?? DEFAULT_CONFIG]]}
              >
                <TooltipProvider>
                  <App />
                </TooltipProvider>
              </HydrateAtoms>
            </JotaiProvider>
            <ReactQueryDevtools
              initialIsOpen={false}
              buttonPosition="bottom-left"
            />
          </QueryClientProvider>,
        )
        return { root, wrapper }
      },
      onRemove: (elements) => {
        elements?.root.unmount()
        elements?.wrapper.remove()
        shadowWrapper = null
      },
    })

    ui.mount()
  },
})

function protectShadowRoot(shadowHost: HTMLElement, wrapper: HTMLElement) {
  // ① 追踪鼠标是否在组件上
  let pointerInside = false
  shadowHost.addEventListener('pointerenter', () => {
    pointerInside = true
  })
  shadowHost.addEventListener('pointerleave', () => {
    pointerInside = false
  })

  window.addEventListener(
    'keydown',
    (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'a')
        return

      const active = document.activeElement

      /* --- 分三种情况 --- */
      if (shadowHost.contains(active)) {
        // A. 焦点已经在组件里 → 放行默认行为
        return
      }

      if (pointerInside) {
        // B. 鼠标悬停在组件里 → 自定义“组件专选”
        e.preventDefault()
        e.stopPropagation()
        requestAnimationFrame(() => selectAllInside(wrapper))
        return
      }

      // C. 其它情况（宿主页面全选，但排除组件）
      e.preventDefault()
      e.stopPropagation()
      requestAnimationFrame(() => rebuildSelectionWithoutHost(shadowHost))
    },
    true, // capture
  )
}

/* 全选组件内部（只需 1 个 Range） */
function selectAllInside(root: HTMLElement) {
  const sel = window.getSelection()
  if (!sel)
    return
  sel.removeAllRanges()

  const range = document.createRange()
  range.selectNodeContents(root) // 选中整个 wrapper ⭐
  sel.addRange(range) // 立即呈现高亮
}

function rebuildSelectionWithoutHost(shadowHost: HTMLElement) {
  const sel = window.getSelection()
  if (!sel)
    return
  sel.removeAllRanges()

  const before = document.createRange()
  before.setStart(document.body, 0)
  before.setEndBefore(shadowHost)

  const after = document.createRange()
  after.setStartAfter(shadowHost)
  after.setEnd(document.body, document.body.childNodes.length)

  sel.addRange(before)
  sel.addRange(after)
}
