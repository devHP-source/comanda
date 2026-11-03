import { useRef } from 'react'
import Icon from '../Icon/Icon.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import styles from './MenuSearch.module.css'

const MenuSearch = ({ value, onChange, className = '' }) => { // Filters while typing: Enter only closes the phone keyboard
  const { t } = useLanguage()
  const inputRef = useRef(null)

  const handleSubmit = (event) => {
    event.preventDefault()
    inputRef.current.blur()
  }

  return (
    <form role="search" className={`${styles.field} ${className}`} onSubmit={handleSubmit}>
      <label htmlFor="menu-search" className="visually-hidden">{t('menu.searchLabel')}</label>
      <Icon name="search" size={20} className={styles.icon} />
      <input
        ref={inputRef}
        id="menu-search"
        type="search"
        className={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('menu.searchPlaceholder')}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
      />
    </form>
  )
}

export default MenuSearch
