import { AlertCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export function ErrorButton({ error }: { error: Error }) {
  const [showDetails, setShowDetails] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // Close popup when clicking outside
  useEffect(() => {
    if (!showDetails)
      return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current
        && !popupRef.current.contains(event.target as Node)
        && buttonRef.current
        && !buttonRef.current.contains(event.target as Node)
      ) {
        setShowDetails(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDetails])

  // Calculate popup position
  const getPopupStyle = (): React.CSSProperties => {
    if (!buttonRef.current)
      return {}

    const buttonRect = buttonRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Default position: below and to the right of the button
    let left = buttonRect.left
    let top = buttonRect.bottom + 4

    // Adjust if popup would go off-screen
    const popupWidth = 320
    const popupHeight = 100

    if (left + popupWidth > viewportWidth) {
      left = viewportWidth - popupWidth - 16
    }

    if (top + popupHeight > viewportHeight) {
      top = buttonRect.top - popupHeight - 4
    }

    return {
      position: 'fixed',
      left: `${Math.max(16, left)}px`,
      top: `${Math.max(16, top)}px`,
      zIndex: 2147483647,
    }
  }

  const errorButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: '#ef4444',
    cursor: 'pointer',
    padding: '0',
    margin: '0 2px',
    transition: 'all 0.2s ease',
  }

  const popupStyle: React.CSSProperties = {
    ...getPopupStyle(),
    backgroundColor: '#ffffff',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
    padding: '12px',
    maxWidth: '320px',
    minWidth: '250px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    lineHeight: '1.4',
  }

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  }

  const textContentStyle: React.CSSProperties = {
    flex: 1,
  }

  const titleStyle: React.CSSProperties = {
    fontWeight: 500,
    color: '#7f1d1d',
    marginBottom: '4px',
  }

  const messageStyle: React.CSSProperties = {
    color: '#991b1b',
    wordBreak: 'break-word',
  }

  const closeButtonStyle: React.CSSProperties = {
    color: '#9ca3af',
    background: 'none',
    border: 'none',
    width: '16px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: '1',
    transition: 'color 0.2s ease',
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        style={errorButtonStyle}
        title="Translation failed - click to see details"
        aria-label="Show translation error details"
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#fef2f2'
          e.currentTarget.style.color = '#dc2626'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = '#ef4444'
        }}
      >
        <AlertCircle style={{ width: '14px', height: '14px' }} />
      </button>

      {showDetails && (
        <div ref={popupRef} style={popupStyle}>
          <div style={contentStyle}>
            <AlertCircle
              style={{
                width: '16px',
                height: '16px',
                color: '#ef4444',
                flexShrink: 0,
                marginTop: '2px',
              }}
            />
            <div style={textContentStyle}>
              <div style={titleStyle}>
                Translation Failed
              </div>
              <div style={messageStyle}>
                {error.message || 'An unknown error occurred'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              style={closeButtonStyle}
              aria-label="Close error details"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#6b7280'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#9ca3af'
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </span>
  )
}
