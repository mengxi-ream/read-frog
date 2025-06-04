import type { TransNode } from '@/types/dom'
import { ErrorButton } from './error-button'
import { RetryButton } from './retry-button'

export function TranslationError({ node, error }: { node: TransNode | TransNode[], error: Error }) {
  const errorContainerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
  }

  return (
    <div style={errorContainerStyle}>
      <RetryButton node={node} />
      <ErrorButton error={error} />
    </div>
  )
}
