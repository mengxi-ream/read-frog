/// <reference types="chrome" />

import { toast } from 'sonner' // 如果项目用 toast 通知
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { PageLayout } from '../../components/page-layout'
import { ReadConfig } from './read-config'
import TranslationConfig from './translation-config'

function resetToDefaultConfig() {
  chrome.storage.local.clear(() => {
    toast.success('已重置为默认配置，请刷新页面')
    location.reload()
  })
}

export function GeneralPage() {
  return (
    <PageLayout
      title={i18n.t('options.general.title')}
      innerClassName="[&>*]:border-b [&>*:last-child]:border-b-0"
    >
      <ReadConfig />
      <TranslationConfig />

      {/* 重置配置按钮 + 弹出确认框 */}
      <div className="mt-4 flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">重置配置</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认重置所有配置？</AlertDialogTitle>
              <AlertDialogDescription>
                此操作会清除所有用户配置，并恢复为默认设置。操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={resetToDefaultConfig}>
                确认重置
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageLayout>
  )
}
