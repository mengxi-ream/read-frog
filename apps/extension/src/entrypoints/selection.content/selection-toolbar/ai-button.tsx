import { Icon } from '@iconify/react'

export default function AiButton() {
  const handleClick = () => {
    // eslint-disable-next-line no-console
    console.log('handleClick')
  }

  // eslint-disable-next-line turbo/no-undeclared-env-vars
  if (!import.meta.env.DEV) {
    return null
  }

  return (
    <button type="button" className="size-6 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer" onClick={handleClick}>
      <Icon icon="hugeicons:ai-innovation-02" strokeWidth={0.8} className="size-4" />
    </button>
  )
}
