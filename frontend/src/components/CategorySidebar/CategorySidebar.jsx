import Icon from '../Icon/Icon.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import styles from './CategorySidebar.module.css'

const CategorySidebar = ({ items, activeId, onSelect, className = '' }) => { // Desktop: sticky category list next to the dishes, the section being read is highlighted
  const { t } = useLanguage()

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

      <p className={styles.note}>
        <Icon name="info" size={18} className={styles.noteIcon} />
        <span>{t('menu.noteAllergens')}</span>
      </p>
    </aside>
  )
}

export default CategorySidebar
