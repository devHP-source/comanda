import Icon from '../Icon/Icon.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import styles from './LanguagePill.module.css'

// Each language is named in its own language, no flags
const LANGUAGE_NAMES = { it: 'Italiano', en: 'English' }

const LanguagePill = ({ className = '' }) => {
  const { lang, setLang, languages, t } = useLanguage()
  const next = languages[(languages.indexOf(lang) + 1) % languages.length]

  return (
    <button
      type="button"
      className={`${styles.pill} ${className}`}
      onClick={() => setLang(next)}
    >
      <Icon name="globe" size={17} />
      <span aria-hidden="true">{lang.toUpperCase()}</span>
      <span className="visually-hidden">
        {t('language.label')}: {LANGUAGE_NAMES[lang]}. {t('language.switchTo', { name: LANGUAGE_NAMES[next] })}
      </span>
    </button>
  )
}

export default LanguagePill
