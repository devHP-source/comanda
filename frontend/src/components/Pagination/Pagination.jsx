import useLanguage from '../../hooks/useLanguage.js'
import styles from './Pagination.module.css'

// 1 … 4 5 6 … 10: first, last, the current page and its neighbours. A gap of one page shows that page instead of "…"
const pageItems = (page, totalPages) => {
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b)

  const items = []
  pages.forEach((item, index) => {
    if (index > 0) {
      const previous = pages[index - 1]
      if (item - previous === 2) items.push(previous + 1)
      else if (item - previous > 2) items.push(`gap-${item}`) // string = "…", the key stays unique
    }
    items.push(item)
  })
  return items
}

// Numbered pages + Precedente / Successiva. The parent owns the page (usually in the URL) and changes it in onPageChange
const Pagination = ({ page, totalPages, onPageChange, label }) => {
  const { t } = useLanguage()
  if (totalPages <= 1) return null

  return (
    <nav className={styles.pagination} aria-label={label}>
      <button type="button" className={styles.step} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        {t('pagination.previous')}
      </button>

      <ol className={styles.pages}>
        {pageItems(page, totalPages).map((item) => (typeof item === 'string' ? (
          <li key={item} className={styles.gap} aria-hidden="true">…</li>
        ) : (
          <li key={item}>
            <button
              type="button"
              className={`${styles.page} ${item === page ? styles.current : ''}`}
              aria-current={item === page ? 'page' : undefined}
              aria-label={t('pagination.pageLabel', { page: item })}
              onClick={() => item !== page && onPageChange(item)}
            >
              {item}
            </button>
          </li>
        )))}
      </ol>

      <button type="button" className={styles.step} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        {t('pagination.next')}
      </button>

      <p className="visually-hidden" aria-live="polite">{t('pagination.status', { page, total: totalPages })}</p>
    </nav>
  )
}

export default Pagination
