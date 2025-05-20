import { toast } from 'sonner'
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
import { ConfigCard } from '../../components/config-card'
import { PageLayout } from '../../components/page-layout'
import { ReadConfig } from './read-config'
import TranslationConfig from './translation-config'

function resetToDefaultConfig() {
  browser.storage.local.remove('config').then(() => {
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
      {/* 配置读取模块 */}
      <ConfigCard title="配置同步" description="从本地文件导入或导出当前配置">
        <ReadConfig />
      </ConfigCard>

      {/* 翻译配置模块 */}
      <ConfigCard
        title="翻译引擎设置"
        description="配置翻译 API 密钥和首选翻译服务"
      >
        <TranslationConfig />
      </ConfigCard>

      {/* 重置配置模块 */}
      <ConfigCard
        title="危险操作区"
        description="执行不可逆的配置操作"
        className="!border-red-100" // 特殊样式标记危险区域
      >
        <div className="flex justify-end">
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
      </ConfigCard>
    </PageLayout>
  )
}
