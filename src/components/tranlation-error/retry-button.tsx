import type { TransNode } from '@/types/dom'
import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { cleanupReactWrapper } from '@/utils/render-react-component'

interface RetryButtonProps {
  node: TransNode | TransNode[]
  onRetry?: () => void
}

// Find the error wrapper element that contains this retry button
function findErrorWrapper(): HTMLElement | null {
  const element = document.querySelector('.read-frog-error-wrapper')
  if (element && element instanceof HTMLElement) {
    return element
  }
  return null
}

export function RetryButton({ node, onRetry }: RetryButtonProps) {
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetry = async () => {
    if (isRetrying)
      return

    setIsRetrying(true)
    try {
      // Find the error wrapper element
      const errorWrapper = findErrorWrapper()

      // Import the translation functions dynamically to avoid circular dependencies
      const { translateNode, translateConsecutiveInlineNodes } = await import('@/utils/host/translate/node-manipulation')

      if (Array.isArray(node)) {
        await translateConsecutiveInlineNodes(node)
      }
      else {
        await translateNode(node)
      }

      // If translation succeeded, clean up and remove the error wrapper
      if (errorWrapper) {
        cleanupReactWrapper(errorWrapper)
      }

      // Call optional callback
      onRetry?.()
    }
    catch (error) {
      logger.error('Retry translation failed:', error)
      // Keep the error display if retry fails
    }
    finally {
      setIsRetrying(false)
    }
  }

  const retryButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: isRetrying ? '#9ca3af' : '#2563eb',
    cursor: isRetrying ? 'not-allowed' : 'pointer',
    padding: '0',
    margin: '0 2px',
    transition: 'all 0.2s ease',
    opacity: isRetrying ? 0.6 : 1,
  }

  const iconStyle: React.CSSProperties = {
    width: '14px',
    height: '14px',
    transform: isRetrying ? 'rotate(360deg)' : 'rotate(0deg)',
    transition: 'transform 1s linear',
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={handleRetry}
        disabled={isRetrying}
        style={retryButtonStyle}
        title={isRetrying ? 'Retrying translation...' : 'Retry translation'}
        aria-label={isRetrying ? 'Retrying translation' : 'Retry translation'}
        onMouseEnter={(e) => {
          if (!isRetrying) {
            e.currentTarget.style.backgroundColor = '#eff6ff'
            e.currentTarget.style.color = '#1d4ed8'
          }
        }}
        onMouseLeave={(e) => {
          if (!isRetrying) {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#2563eb'
          }
        }}
      >
        <RotateCcw style={iconStyle} />
      </button>
    </span>
  )
}
