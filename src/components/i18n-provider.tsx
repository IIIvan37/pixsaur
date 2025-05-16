'use client'

import { type ReactNode, useEffect } from 'react'
import { i18n } from '@lingui/core'
import { I18nProvider as LinguiProvider } from '@lingui/react'
import { loadMessages, useLanguageStore } from '@/locales/i18n'

interface I18nProviderProps {
  children: ReactNode
}

export default function I18nProvider({ children }: I18nProviderProps) {
  const { locale } = useLanguageStore()

  useEffect(() => {
    loadMessages(locale)
  }, [locale])

  return <LinguiProvider i18n={i18n}>{children}</LinguiProvider>
}
