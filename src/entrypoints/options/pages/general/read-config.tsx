import type { ReadProviderNames } from '@/types/config/provider'
import deepmerge from 'deepmerge'
import { useAtom, useAtomValue } from 'jotai'
import ProviderIcon from '@/components/provider-icon'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { readProviderModels } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'
import { READ_PROVIDER_ITEMS } from '@/utils/constants/config'
import { ConfigCard } from '../../components/config-card'
import { FieldWithLabel } from '../../components/field-with-label'
import { SetApiKeyWarning } from '../../components/set-api-key-warning'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'

export function ReadConfig() {
  return (
    <ConfigCard title="阅读配置" description="设置阅读功能相关的提供者和模型">
      <div className="flex flex-col gap-4">
        <ReadProviderSelector />
        <ReadModelSelector />
      </div>
    </ConfigCard>
  )
}

function ReadProviderSelector() {
  const [readConfig, setReadConfig] = useAtom(configFields.read)
  const providersConfig = useAtomValue(configFields.providersConfig)
  const providerConfig = providersConfig[readConfig.provider]

  return (
    <FieldWithLabel
      id="readProvider"
      label={(
        <div className="flex gap-2">
          阅读提供者
          {!providerConfig.apiKey && <SetApiKeyWarning />}
        </div>
      )}
    >
      <Select
        value={readConfig.provider}
        onValueChange={(value: ReadProviderNames) =>
          setReadConfig(
            { ...readConfig, provider: value },
          )}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Object.entries(READ_PROVIDER_ITEMS).map(([value, { logo, name }]) => (
              <SelectItem key={value} value={value}>
                <ProviderIcon logo={logo} name={name} />
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FieldWithLabel>
  )
}

function ReadModelSelector() {
  const [readConfig, setReadConfig] = useAtom(configFields.read)
  const modelConfig = readConfig.models[readConfig.provider]

  const resetToDefault = () => {
    setReadConfig(deepmerge(readConfig, {
      models: {
        [readConfig.provider]: {
          customModel: '',
          isCustomModel: false,
          model: readProviderModels[readConfig.provider][0],
        },
      },
    }))
  }

  return (
    <FieldWithLabel id="readModel" label="阅读模型">
      {modelConfig.isCustomModel
        ? (
            <Input
              value={modelConfig.customModel}
              onChange={e =>
                setReadConfig(deepmerge(readConfig, {
                  models: {
                    [readConfig.provider]: {
                      customModel: e.target.value,
                    },
                  },
                }))}/>
          )
        : (
            <Select
              value={modelConfig.model}
              onValueChange={value =>
                setReadConfig(deepmerge(readConfig, {
                  models: {
                    [readConfig.provider]: {
                      model: value,
                    },
                  },
                }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择模型" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {readProviderModels[readConfig.provider].map(model => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
      <div className="mt-0.5 flex items-center space-x-2">
        <Checkbox
          id={`isCustomModel-${readConfig.provider}`}
          checked={modelConfig.isCustomModel}
          onCheckedChange={(checked) => {
            if (checked === false) {
              setReadConfig(deepmerge(readConfig, {
                models: {
                  [readConfig.provider]: {
                    customModel: '',
                    isCustomModel: false,
                  },
                },
              }))
            } else {
              setReadConfig(deepmerge(readConfig, {
                models: {
                  [readConfig.provider]: {
                    customModel: readConfig.models[readConfig.provider].model,
                    isCustomModel: true,
                  },
                },
              }))
            }
          }}
        />
        <label
          htmlFor={`isCustomModel-${readConfig.provider}`}
          className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          输入自定义模型名称
        </label>
      </div>

      {/* ✅ 添加带确认的“重置模型”按钮 */}
      <div className="mt-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="text-sm text-red-600 hover:underline">
              重置为默认模型
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认重置？</AlertDialogTitle>
              <AlertDialogDescription>
                这将清除当前自定义模型并还原为默认模型，操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={resetToDefault}>确认重置</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </FieldWithLabel>
  )
}
