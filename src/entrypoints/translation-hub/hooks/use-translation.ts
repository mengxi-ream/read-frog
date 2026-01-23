import type { ServiceInfo, TranslationResult } from '../types'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useEffect, useEffectEvent, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { filterEnabledProvidersConfig, getProviderConfigById } from '@/utils/config/helpers'
import { executeTranslate } from '@/utils/host/translate/execute-translate'
import {
  inputTextAtom,
  selectedServicesAtom,
  sourceLanguageAtom,
  targetLanguageAtom,
  translationResultsAtom,
} from '../atoms'

export function useTranslation() {
  const language = useAtomValue(configFieldsAtomMap.language)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const enabledProviders = useMemo(() => filterEnabledProvidersConfig(providersConfig), [providersConfig])

  const [sourceLanguage, setSourceLanguage] = useAtom(sourceLanguageAtom)
  const [targetLanguage, setTargetLanguage] = useAtom(targetLanguageAtom)
  const [inputText, setInputText] = useAtom(inputTextAtom)
  const [selectedServices, setSelectedServices] = useAtom(selectedServicesAtom)
  const [translationResults, setTranslationResults] = useAtom(translationResultsAtom)

  // Initialization Effects
  const isInitRef = useRef({ lang: false, services: false })

  useEffect(() => {
    if (!isInitRef.current.lang && language) {
      setSourceLanguage(language.sourceCode === 'auto' ? 'eng' : language.sourceCode)
      setTargetLanguage(language.targetCode)
      isInitRef.current.lang = true
    }
  }, [language, setSourceLanguage, setTargetLanguage])

  useEffect(() => {
    if (!isInitRef.current.services && enabledProviders.length > 0) {
      if (selectedServices.length === 0) {
        // Initialize with all enabled providers as selected
        const services: ServiceInfo[] = enabledProviders.map(p => ({
          id: p.id,
          name: p.name,
          provider: p.provider,
          type: 'ai', // Default type, will be refined based on actual provider type
        }))
        setSelectedServices(services)
      }
      isInitRef.current.services = true
    }
  }, [enabledProviders, selectedServices.length, setSelectedServices])

  // Race condition handling
  const activeRequestIdsRef = useRef<Record<string, number>>({})
  const requestCounterRef = useRef(0)

  // Core Translation Logic
  const translateServices = useCallback(async (services: ServiceInfo[]) => {
    if (!inputText.trim() || services.length === 0)
      return

    // Optimistic UI update
    setTranslationResults((prev) => {
      const targetIds = new Set(services.map(s => s.id))
      const existing = prev.filter(r => !targetIds.has(r.id))
      const newEntries = services.map(s => ({
        id: s.id,
        name: s.name,
        provider: s.provider,
        isLoading: true,
        text: prev.find(r => r.id === s.id)?.text,
      }))
      return [...existing, ...newEntries]
    })

    const updateResult = (id: string, updates: Partial<TranslationResult>) => {
      setTranslationResults(prev => prev.map(r => (r.id === id ? { ...r, ...updates } : r)))
    }

    const runTranslation = async (service: ServiceInfo) => {
      const requestId = ++requestCounterRef.current
      activeRequestIdsRef.current[service.id] = requestId

      try {
        const providerConfig = getProviderConfigById(providersConfig, service.id)
        if (!providerConfig)
          throw new Error(`Provider config not found for ${service.id}`)

        const text = await executeTranslate(inputText, {
          sourceCode: sourceLanguage,
          targetCode: targetLanguage,
          level: language.level,
        }, providerConfig)

        // if a newer request started for this service, ignore this result
        if (activeRequestIdsRef.current[service.id] !== requestId)
          return

        updateResult(service.id, { text, isLoading: false, error: undefined })
      }
      catch (error) {
        if (activeRequestIdsRef.current[service.id] !== requestId)
          return

        updateResult(service.id, {
          error: error instanceof Error ? error.message : 'Translation failed',
          isLoading: false,
          text: undefined,
        })
      }
    }

    await Promise.allSettled(services.map(runTranslation))
  }, [inputText, sourceLanguage, targetLanguage, language.level, providersConfig, setTranslationResults])

  // Handlers
  const handleTranslate = useCallback(async () => {
    await translateServices(selectedServices)
  }, [selectedServices, translateServices])

  const handleLanguageExchange = useCallback(() => {
    setSourceLanguage(targetLanguage)
    setTargetLanguage(sourceLanguage)
  }, [sourceLanguage, targetLanguage, setSourceLanguage, setTargetLanguage])

  // New handler for multi-select onValueChange
  const handleServicesChange = useCallback((selectedIds: string[]) => {
    const newSelectedServices: ServiceInfo[] = []
    const servicesToTranslate: ServiceInfo[] = []

    for (const id of selectedIds) {
      // Check if already selected
      const existing = selectedServices.find(s => s.id === id)
      if (existing) {
        newSelectedServices.push(existing)
      }
      else {
        // Find in enabled providers and add as new
        const provider = enabledProviders.find(p => p.id === id)
        if (provider) {
          const newService: ServiceInfo = {
            id: provider.id,
            name: provider.name,
            provider: provider.provider,
            type: 'ai', // Default type
          }
          newSelectedServices.push(newService)
          servicesToTranslate.push(newService)
        }
      }
    }

    setSelectedServices(newSelectedServices)

    // Remove results for deselected services
    const selectedIdSet = new Set(selectedIds)
    setTranslationResults(prev => prev.filter(r => selectedIdSet.has(r.id)))

    // Translate newly selected services if there's input text
    if (inputText.trim() && servicesToTranslate.length > 0) {
      void translateServices(servicesToTranslate)
    }
  }, [selectedServices, enabledProviders, inputText, translateServices, setSelectedServices, setTranslationResults])

  const handleInputChange = useCallback((value: string) => {
    setInputText(value)
    if (!value.trim())
      setTranslationResults([])
  }, [setInputText, setTranslationResults])

  // Auto-translate Logic
  const languageKey = `${sourceLanguage}-${targetLanguage}`
  const prevLangKeyRef = useRef(languageKey)

  const onAutoTranslate = useEffectEvent(() => {
    if (inputText.trim() && selectedServices.length > 0 && translationResults.length > 0) {
      void handleTranslate()
    }
  })

  useEffect(() => {
    if (prevLangKeyRef.current !== languageKey) {
      prevLangKeyRef.current = languageKey
      onAutoTranslate()
    }
  }, [languageKey])

  return {
    sourceLanguage,
    setSourceLanguage,
    targetLanguage,
    setTargetLanguage,
    inputText,
    handleInputChange,
    selectedServices,
    setSelectedServices,
    translationResults,
    handleTranslate,
    handleLanguageExchange,
    handleCopyText: useCallback((text: string) => {
      void navigator.clipboard.writeText(text)
      toast.success('Translation copied to clipboard!')
    }, []),
    handleRemoveService: useCallback((id: string) => {
      setSelectedServices(prev => prev.filter(s => s.id !== id))
      setTranslationResults(prev => prev.filter(r => r.id !== id))
    }, [setSelectedServices, setTranslationResults]),
    handleServicesChange,
  }
}
