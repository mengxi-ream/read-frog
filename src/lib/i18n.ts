// src/lib/i18n.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

i18n.use(initReactI18next).init({
  fallbackLng: 'en',
  debug: true,
  interpolation: {
    escapeValue: false, // react already safes from xss
  },
  resources: {
    en: {
      translation: {
        'Reset Config': 'Reset Config',
        'Danger Zone': 'Danger Zone',
        'Irreversible Operation': 'This action cannot be undone.',
        'Confirm Reset': 'Confirm Reset',
        'Cancel': 'Cancel',
        'Reset': 'Reset',
        'Config reset successfully': 'Config reset successfully',
      },
    },
    zh: {
      translation: {
        'Reset Config': '重置配置',
        'Danger Zone': '危险操作区',
        'Irreversible Operation': '此操作不可撤销。',
        'Confirm Reset': '确认重置',
        'Cancel': '取消',
        'Reset': '重置',
        'Config reset successfully': '已重置为默认配置',
      },
    },
  },
})

export default i18n
