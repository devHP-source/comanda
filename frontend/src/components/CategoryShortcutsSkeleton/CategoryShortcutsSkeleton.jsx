import Skeleton from '../Skeleton/Skeleton.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import realStyles from '../CategoryShortcuts/CategoryShortcuts.module.css' // the real component's classes: same sizes at every breakpoint
import styles from './CategoryShortcutsSkeleton.module.css'

const ITEMS = 12 // enough to fill a tablet's width

const CategoryShortcutsSkeleton = () => {
  const { lang } = useLanguage()
  const labelLines = lang === 'en' ? 2 : 1 // the tallest label sets the row's height, and "Rice & Noodles" wraps

  return (
    <div className={realStyles.nav}>
      <div className={`${realStyles.strip} hide-scrollbar`}>
        {Array.from({ length: ITEMS }, (_, index) => (
          <div key={index}>
            <div className={realStyles.shortcut}>
              <Skeleton width="4rem" height="4rem" radius="var(--radius-round)" />
              <div className={styles.label}>
                {Array.from({ length: labelLines }, (_, line) => <Skeleton key={line} width="3rem" height="0.75rem" />)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CategoryShortcutsSkeleton
