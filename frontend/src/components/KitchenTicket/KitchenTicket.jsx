import { useId } from 'react'
import Icon from '../Icon/Icon.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import formatTime from '../../utils/formatTime.js'
import styles from './KitchenTicket.module.css'

const NEXT_STEP = { // The kitchen's one button per ticket: sent --> preparing --> ready. A ready ticket waits for the waiter
  sent: { status: 'preparing', label: 'kitchen.start', icon: 'chef' },
  preparing: { status: 'ready', label: 'kitchen.markReady', icon: 'check' },
}

const KitchenTicket = ({ ticket, now, onAdvance }) => { // Big card for the kitchen board. Dish names and notes stay Italian (snapshots), only the labels follow the language
  const { t } = useLanguage()
  const titleId = useId()
  const next = NEXT_STEP[ticket.status]
  const waitingMinutes = Math.max(0, Math.floor((now - new Date(ticket.createdAt)) / 60000)) // `now` = last poll; never negative if the phone's clock is a bit behind

  return (
    <article className={`${styles.ticket} ${styles[ticket.status]}`} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div>
          <h3 id={titleId} className={styles.table}>
            {t('tables.tableNumber', { number: ticket.tableNumber })}
            <span className={styles.round}>{t('tables.round', { round: ticket.round })}</span>
          </h3>
        </div>
        <p className={styles.time}>
          <Icon name="clock" size={16} />
          <span className="visually-hidden">{t('kitchen.sentAt')}</span>
          <time dateTime={ticket.createdAt}>{formatTime(ticket.createdAt)}</time>
          <span aria-hidden="true">·</span>
          <span className="visually-hidden">{t('kitchen.waitingFor')}</span>
          {t('kitchen.minutes', { count: waitingMinutes })}
        </p>
      </header>

      <ul className={styles.items}>
        {ticket.items.map((item, index) => ( // items have no _id (never edited) and their order never changes
          <li key={index} className={styles.item}>
            <span className={styles.qty}>{item.qty}×</span>
            <div>
              <p className={styles.name}>
                <span className={styles.code}>{item.codeSnapshot}</span> {item.nameSnapshot}
              </p>
              {item.notes && <p className={styles.note}>{item.notes}</p>}
            </div>
          </li>
        ))}
      </ul>

      {next ? (
        <button
          type="button"
          className={styles.action}
          aria-describedby={titleId} // "Inizia preparazione, Tavolo 12 2a comanda" for screen readers
          onClick={() => onAdvance(ticket, next.status)}
        >
          {t(next.label)}
          <Icon name={next.icon} size={20} />
        </button>
      ) : (
        <p className={styles.waiting}>
          <Icon name="check" size={20} />
          {t('kitchen.waitingWaiter')}
        </p>
      )}
    </article>
  )
}

export default KitchenTicket
