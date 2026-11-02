import { useContext } from 'react'
import { LanguageContext } from '../context/LanguageContext.js'

const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside <LanguageProvider>')
  return context
}

export default useLanguage
