import Icon from '../Icon/Icon.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import dishCount from '../../utils/dishCount.js'
import styles from './ReadyTicketCard.module.css'

const ReadyTicketCard = ({ ticket, onServe }) => { // A ticket the kitchen marked ready, waiting to be brought to the table. `onServe` opens the confirm modal
  const { t } = useLanguage()
  const count = dishCount(ticket)

  return (
    <article className={styles.card}>
      <div className={styles.top}>
        <span className={styles.icon}><Icon name="dish" size={18} /></span>
        <span className={styles.kicker}>{t('waiter.readyNow')}</span>
      </div>

      <h3 className={styles.table}>{t('tables.tableNumber', { number: ticket.tableNumber })}</h3>
      <p className={styles.round}>
        {t('tables.round', { round: ticket.round })}
        {' · '}
        {count === 1 ? t('tables.dishesOne') : t('tables.dishes', { count })}
      </p>

      <button type="button" className={styles.serve} onClick={() => onServe(ticket)}>
        <Icon name="check" size={18} />
        {t('waiter.markServed')}
      </button>
    </article>
  )
}

export default ReadyTicketCard
