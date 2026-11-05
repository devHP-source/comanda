import useLanguage from '../../hooks/useLanguage.js'
import formatPrice from '../../utils/formatPrice.js'
import styles from './TableTile.module.css'

const TableTile = ({ table, onSelect }) => { // One table of the room grid, from GET /api/tables: { number, status, openTickets, total }. With `onSelect` the tile is a button
  const { t } = useLanguage()
  const { number, status, openTickets, total } = table

  let label = t(`tables.status.${status}`) // free | preparing | ready
  if (status === 'occupied') label = openTickets === 1 ? t('tables.ticketsOne') : t('tables.tickets', { count: openTickets })

  const content = (
    <>
      <span className={styles.number}>
        <span className="visually-hidden">{t('tables.table')} </span>
        {number}
      </span>
      <span className={styles.status}>{label}</span>
      {status !== 'free' && <span className={styles.total}>{formatPrice(total)}</span>}
    </>
  )

  const className = `${styles.tile} ${styles[status]}`

  if (!onSelect) return <div className={className}>{content}</div>

  return (
    <button type="button" className={`${className} ${styles.button}`} aria-haspopup="dialog" onClick={() => onSelect(number)}>
      {content}
    </button>
  )
}

export default TableTile
