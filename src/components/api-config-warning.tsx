export function APIConfigWarning({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-md border border-amber-500 bg-amber-100 px-2 py-1.5 text-center text-sm font-medium',
        className,
      )}
    >
      {i18n.t('noConfig.warningWithLink.youMust')}
      {' '}
      <a
        href="https://readfrog.mengxi.work/tutorial/api-key"
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        {i18n.t('noConfig.warningWithLink.setTheAPIKey')}
      </a>
      {' '}
      {i18n.t('noConfig.warningWithLink.firstOnThe')}
      {' '}
      <button
        className="cursor-pointer underline"
        onClick={() => sendMessage('openOptionsPage', undefined)}
      >
        {i18n.t('noConfig.warningWithLink.optionsPage')}
      </button>
      {' '}
      {i18n.t('noConfig.warningWithLink.page')}
      .
    </div>
  )
}
