import useLanguage from '../../hooks/useLanguage.js'
import formatPrice from '../../utils/formatPrice.js'
import styles from './TableTile.module.css'

const TableTile = ({ table }) => { // One table of the room grid, from GET /api/tables: { number, status, openTickets, total }
  const { t } = useLanguage()
  const { number, status, openTickets, total } = table

  let label = t(`tables.status.${status}`) // free | preparing | ready
  if (status === 'occupied') label = openTickets === 1 ? t('tables.ticketsOne') : t('tables.tickets', { count: openTickets })

  return (
    <div className={`${styles.tile} ${styles[status]}`}>
      <span className={styles.number}>
        <span className="visually-hidden">{t('tables.table')} </span>
        {number}
      </span>
      <span className={styles.status}>{label}</span>
      {status !== 'free' && <span className={styles.total}>{formatPrice(total)}</span>}
    </div>
  )
}

export default TableTile
