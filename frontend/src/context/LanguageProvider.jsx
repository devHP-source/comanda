import { useCallback, useEffect, useMemo, useState } from 'react'
import { LanguageContext } from './LanguageContext.js'
import { getErrorCode, getErrorMessage } from '../api/client.js'
import it from '../i18n/it.json'
import en from '../i18n/en.json'

const SUPPORTED_LANGS = ['it', 'en']
const DEFAULT_LANG = 'it' // content fallback for missing translations
const UNKNOWN_BROWSER_LANG = 'en' // a browser with no supported language is a tourist's
const STORAGE_KEY = 'comanda_lang'
const dictionaries = { it, en }

const readStoredLang = () => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

const storeLang = (lang) => {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // storage unavailable: the choice lasts until the page is reloaded
  }
}

// Saved choice first, then the browser's languages in order ("en-US" → "en"), then English
const detectLang = () => {
  const stored = readStoredLang()
  if (SUPPORTED_LANGS.includes(stored)) return stored

  const browserLangs = navigator.languages?.length ? navigator.languages : [navigator.language]
  const match = browserLangs
    .map((code) => code?.slice(0, 2).toLowerCase())
    .find((code) => SUPPORTED_LANGS.includes(code))
  return match || UNKNOWN_BROWSER_LANG
}

// "errors.ROUTE_NOT_FOUND" → dictionary.errors.ROUTE_NOT_FOUND, undefined when missing
const lookup = (dictionary, key) =>
  key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dictionary)

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(detectLang)

  useEffect(() => {
    document.documentElement.lang = lang // screen readers pronounce the page in the right language
  }, [lang])

  const setLang = useCallback((next) => {
    if (!SUPPORTED_LANGS.includes(next)) return
    setLangState(next)
    storeLang(next)
  }, [])

  // Missing in the current language → Italian → the key itself (easy to spot on screen)
  // Placeholders: t('waiter.table', { number: 12 }) with "Tavolo {number}"
  const t = useCallback((key, values) => {
    const text = lookup(dictionaries[lang], key) ?? lookup(dictionaries[DEFAULT_LANG], key) ?? key
    if (!values) return text
    return text.replace(/\{(\w+)\}/g, (placeholder, name) => values[name] ?? placeholder)
  }, [lang])

  // Translated fields from the API: { it: 'Riso', en: 'Rice' }
  const pick = useCallback((field) => field?.[lang] || field?.it || '', [lang])

  // Toast text for a failed request: translated code, else the API's English message
  const tError = useCallback((error) => {
    const key = `errors.${getErrorCode(error)}`
    return lookup(dictionaries[lang], key) ?? lookup(dictionaries[DEFAULT_LANG], key) ?? getErrorMessage(error)
  }, [lang])

  const value = useMemo(
    () => ({ lang, setLang, languages: SUPPORTED_LANGS, t, pick, tError }),
    [lang, setLang, t, pick, tError],
  )

  return <LanguageContext value={value}>{children}</LanguageContext>
}
