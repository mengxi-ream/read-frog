'use client'

import { useEffect, useState } from 'react'

export function useHasTranslation() {
  const [hasTranslated, setHasTranslated] = useState(false)

  useEffect(() => {
    // 检查元素是否存在的函数
    const checkElement = () => {
      const element = document.querySelector(
        '.read-frog-translated-content-wrapper',
      )
      setHasTranslated(!!element)
    }

    // 初始检查
    checkElement()

    // 创建 MutationObserver 来监听 DOM 变化
    const observer = new MutationObserver(() => {
      checkElement()
    })

    // 开始观察整个文档的变化
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    })

    // 清理函数
    return () => {
      observer.disconnect()
    }
  }, [])

  return hasTranslated
}
