import Icon from '../Icon/Icon.jsx'
import LoadingState from '../LoadingState/LoadingState.jsx'
import Skeleton from '../Skeleton/Skeleton.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import styles from './CategorySidebar.module.css'

const SKELETON_ROWS = 15 // one per menu category
const SKELETON_WIDTHS = ['70%', '50%', '85%', '60%']

const CategorySidebar = ({ items, activeId, onSelect, isLoading = false, className = '' }) => { // Desktop: sticky category list next to the dishes, the section being read is highlighted
  const { t } = useLanguage()

  const note = (
    <p className={styles.note}>
      <Icon name="info" size={18} className={styles.noteIcon} />
      <span>{t('menu.noteAllergens')}</span>
    </p>
  )

  if (isLoading) { // The note waits with the rows: alone at the top of the column, it would jump down when they arrive
    return (
      <aside className={`${styles.sidebar} ${className}`}>
        <LoadingState quiet>
          <Skeleton width="6rem" height="1.125rem" className={styles.label} />
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div key={index} className={styles.item}>
              <Skeleton width={SKELETON_WIDTHS[index % SKELETON_WIDTHS.length]} height="0.9rem" />
            </div>
          ))}
          {note}
        </LoadingState>
      </aside>
    )
  }

  return (
    <aside className={`${styles.sidebar} ${className}`}>
      {items.length > 0 && (
        <nav aria-labelledby="sidebar-label">
          <p id="sidebar-label" className={styles.label}>{t('menu.categories')}</p>
          <ul>
            {items.map((item) => {
              const isActive = item.id === activeId
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={styles.item}
                    aria-current={isActive ? 'true' : undefined}
                    onClick={() => onSelect(item.id)}
                  >
                    <span>{item.label}</span>
                    {isActive && <Icon name="chevron" size={16} />}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      )}

      {note}
    </aside>
  )
}

export default CategorySidebar
