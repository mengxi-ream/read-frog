import { i18n } from '#imports'
import { sendMessage } from '@/utils/message'
import { cn } from '@/utils/styles/utils'

export function APIConfigWarning({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-md border border-amber-500 bg-amber-100 px-2 py-1.5 text-center text-sm font-medium dark:bg-amber-900',
        className,
      )}
    >
      {i18n.t('noAPIKeyConfig.warningWithLink.youMust')}
      {' '}
      <a
        href="https://readfrog.app/tutorial/api-key"
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        {i18n.t('noAPIKeyConfig.warningWithLink.setTheAPIKey')}
      </a>
      {' '}
      {i18n.t('noAPIKeyConfig.warningWithLink.firstOnThe')}
      {' '}
      <button
        type="button"
        className="cursor-pointer underline"
        onClick={() => sendMessage('openOptionsPage', undefined)}
      >
        {i18n.t('noAPIKeyConfig.warningWithLink.optionsPage')}
      </button>
      {' '}
      {i18n.t('noAPIKeyConfig.warningWithLink.page')}
      .
    </div>
  )
}
