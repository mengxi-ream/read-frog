// import { useAtom } from 'jotai'
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from '@/components/ui/card'
// import { Checkbox } from '@/components/ui/checkbox'
// import { Input } from '@/components/ui/input'
// import {
//   Select,
//   SelectContent,
//   SelectGroup,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from '@/components/ui/select'
// import { Switch } from '@/components/ui/switch'
// import { configFields } from '@/utils/atoms/config'
// import { PROVIDER_ITEMS } from '@/utils/constants/config'

// export function ProviderConfigCard({ provider }: { provider: Provider }) {
//   const [showAPIKey, setShowAPIKey] = useState(false)
//   const [providersConfig, setProvidersConfig] = useAtom(
//     configFields.providersConfig,
//   )
//   const [currentProvider, setCurrentProvider] = useAtom(configFields.provider)

//   return (
//     <Card
//       className={cn(
//         'w-[360px]',
//         currentProvider === provider && 'border-primary shadow-primary',
//       )}
//     >
//       <CardHeader>
//         <CardTitle className="flex items-center justify-between">
//           <div className="flex items-center gap-2">
//             <img
//               src={PROVIDER_ITEMS[provider].logo}
//               alt={PROVIDER_ITEMS[provider].name}
//               className="border-border h-6 w-6 rounded-full border bg-white"
//             />
//             {PROVIDER_ITEMS[provider].name}
//           </div>
//           <Switch
//             checked={currentProvider === provider}
//             onCheckedChange={() => {
//               if (currentProvider !== provider) {
//                 setCurrentProvider(provider)
//               }
//             }}
//           />
//         </CardTitle>
//         <CardDescription>
//           {i18n.t(`options.providerConfig.description.${provider}`)}
//         </CardDescription>
//       </CardHeader>
//       <CardContent>
//         <div className="grid max-w-sm items-center gap-0.5">
//           <label htmlFor="email" className="text-sm font-medium">
//             API Key
//           </label>
//           <Input
//             className="mt-1 mb-2"
//             value={providersConfig[provider].apiKey}
//             type={showAPIKey ? 'text' : 'password'}
//             onChange={e =>
//               setProvidersConfig({
//                 ...providersConfig,
//                 [provider]: {
//                   ...providersConfig[provider],
//                   apiKey: e.target.value,
//                 },
//               })}
//           />
//           <div className="flex items-center space-x-2">
//             <Checkbox
//               id={`apiKey-${provider}`}
//               checked={showAPIKey}
//               onCheckedChange={checked => setShowAPIKey(checked === true)}
//             />
//             <label
//               htmlFor={`apiKey-${provider}`}
//               className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
//             >
//               {i18n.t('options.providerConfig.apiKey.showAPIKey')}
//             </label>
//           </div>
//         </div>
//         <div className="mt-6 grid max-w-sm items-center gap-0.5">
//           <label htmlFor="model" className="text-sm font-medium">
//             {i18n.t('options.providerConfig.model.title')}
//           </label>
//           {providersConfig[provider].isCustomModel
//             ? (
//                 <Input
//                   className="mt-1 mb-2"
//                   value={providersConfig[provider].customModel}
//                   onChange={e =>
//                     setProvidersConfig({
//                       ...providersConfig,
//                       [provider]: {
//                         ...providersConfig[provider],
//                         customModel: e.target.value,
//                       },
//                     })}
//                 />
//               )
//             : (
//                 <Select
//                   value={providersConfig[provider].model}
//                   onValueChange={value =>
//                     setProvidersConfig({
//                       ...providersConfig,
//                       [provider]: { ...providersConfig[provider], model: value },
//                     })}
//                 >
//                   <SelectTrigger className="mt-1 w-full">
//                     <SelectValue placeholder="Select a model" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectGroup>
//                       {providerModels[provider].map(model => (
//                         <SelectItem key={model} value={model}>
//                           {model}
//                         </SelectItem>
//                       ))}
//                     </SelectGroup>
//                   </SelectContent>
//                 </Select>
//               )}
//           <div className="mt-2 flex items-center space-x-2">
//             <Checkbox
//               id={`isCustomModel-${provider}`}
//               checked={providersConfig[provider].isCustomModel}
//               onCheckedChange={(checked) => {
//                 if (checked === false) {
//                   setProvidersConfig({
//                     ...providersConfig,
//                     [provider]: {
//                       ...providersConfig[provider],
//                       isCustomModel: false,
//                     },
//                   })
//                 }
//                 else {
//                   setProvidersConfig({
//                     ...providersConfig,
//                     [provider]: {
//                       ...providersConfig[provider],
//                       customModel: providersConfig[provider].model,
//                       isCustomModel: true,
//                     },
//                   })
//                 }
//               }}
//             />
//             <label
//               htmlFor={`isCustomModel-${provider}`}
//               className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
//             >
//               {i18n.t('options.providerConfig.model.enterCustomModel')}
//             </label>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   )
// }
