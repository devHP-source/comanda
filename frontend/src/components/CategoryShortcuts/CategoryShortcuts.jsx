import useLanguage from '../../hooks/useLanguage.js'
import thumbnailUrl from '../../utils/thumbnailUrl.js'
import styles from './CategoryShortcuts.module.css'

const SHORTCUT_IMAGE = 'c_fill,ar_1:1,f_auto,q_auto,w_160' // round 4rem photo, sharp on 2x screens

const CategoryShortcuts = ({ items, onSelect }) => { // Mobile and tablet: round category photos at the top of the menu, a tap jumps to the section
  const { t } = useLanguage()

  return (
    <nav className={styles.nav} aria-label={t('menu.categories')}>
      <ul className={`${styles.strip} hide-scrollbar`}>
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" className={styles.shortcut} onClick={() => onSelect(item.id)}>
              {item.image ? (
                <img
                  className={styles.image}
                  src={thumbnailUrl(item.image, SHORTCUT_IMAGE)}
                  alt="" // the category name is right under it
                  loading="lazy"
                  width="64"
                  height="64"
                />
              ) : (
                <span className={`${styles.image} ${styles.initial}`} aria-hidden="true">
                  {item.label.slice(0, 1)}
                </span>
              )}
              <span className={styles.label}>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default CategoryShortcuts
