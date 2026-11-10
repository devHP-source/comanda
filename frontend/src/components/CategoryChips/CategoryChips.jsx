import { useEffect, useRef } from 'react'
import useLanguage from '../../hooks/useLanguage.js'
import styles from './CategoryChips.module.css'

// Mobile and tablet: sticky category bar, the chip of the category on screen is highlighted (none while searching)
const CategoryChips = ({ items, activeId, onSelect }) => {
  const { t } = useLanguage()
  const stripRef = useRef(null)

  useEffect(() => { // Keeps the active chip centered in the strip (only the strip moves, never the page)
    const strip = stripRef.current
    const chip = strip?.querySelector('[aria-current="true"]')
    if (!chip) return
    strip.scrollTo({ left: chip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2 })
  }, [activeId])

  return (
    <nav className={styles.bar} aria-label={t('menu.chooseCategory')}>
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
