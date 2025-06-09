import type { TransNode } from '@/types/dom'
import { ErrorButton } from './error-button'
import { RetryButton } from './retry-button'

export function TranslationError({ node, error }: { node: TransNode | TransNode[], error: Error }) {
  return (
    <div className="inline-flex items-center justify-center gap-1 px-1.5">
      <RetryButton node={node} />
      <ErrorButton error={error} />
    </div>
  )
}
