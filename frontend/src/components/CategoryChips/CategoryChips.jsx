import { useEffect, useRef } from 'react'
import useLanguage from '../../hooks/useLanguage.js'
import styles from './CategoryChips.module.css'

const CategoryChips = ({ items, activeId, onSelect }) => { // Mobile and tablet: sticky category bar, the chip of the section being read is highlighted
  const { t } = useLanguage()
  const stripRef = useRef(null)

  useEffect(() => { // Keeps the active chip centered in the strip while the page scrolls (only the strip moves, never the page)
    const strip = stripRef.current
    const chip = strip?.querySelector('[aria-current="true"]')
    if (!chip) return
    strip.scrollTo({ left: chip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2 })
  }, [activeId])

  return (
    <nav className={styles.bar} aria-label={t('menu.jumpTo')}>
      <ul ref={stripRef} className={`${styles.strip} hide-scrollbar`}>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={styles.chip}
              aria-current={item.id === activeId ? 'true' : undefined}
              onClick={() => onSelect(item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default CategoryChips
