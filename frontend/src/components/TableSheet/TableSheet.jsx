import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router'
import Icon from '../Icon/Icon.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import formatPrice from '../../utils/formatPrice.js'
import formatTime from '../../utils/formatTime.js'
import styles from './TableSheet.module.css'



const TableSheet = ({ table, tickets, notice, onClose, onServe, onCloseTable }) => { // The selected table: its open tickets, total and actions. Bottom sheet on phones, centered modal from tablet up.
  const { t } = useLanguage()
  const dialogRef = useRef(null)
  const titleId = useId()

  useEffect(() => { // The parent unmounts it to close it; `onServe` and `onCloseTable` open the parent's confirm modals (they stack on top)
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
  }, [])

  const handleBackdropClick = (event) => { // the content fills the dialog, so a click on the dialog itself is on the backdrop
    if (event.target === dialogRef.current) dialogRef.current.close()
  }

  const isFree = table.status === 'free'

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose} // Esc, Android back, backdrop, close button
      onClick={handleBackdropClick}
    >
      <div className={styles.scroll}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>{t('tableSheet.kicker')}</p>
            <h2 id={titleId} className={styles.title}>{t('tables.tableNumber', { number: table.number })}</h2>
            <p className={notice?.type === 'error' ? styles.noticeError : styles.notice} role="status">
              {notice?.text}
            </p>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label={t('tableSheet.close')}
            onClick={() => dialogRef.current.close()}
          >
            <Icon name="close" size={22} />
          </button>
        </header>

        {isFree ? (
          <div className={styles.free}>
            <span className={styles.freeIcon}><Icon name="table" size={24} /></span>
            <div>
              <p className={styles.freeTitle}>{t('tableSheet.freeTitle')}</p>
              <p className={styles.freeText}>{t('tableSheet.freeText')}</p>
            </div>
          </div>
        ) : (
          <>
            <dl className={styles.summary}>
              <div>
                <dt>{t('tableSheet.tickets')}</dt>
                <dd>{table.openTickets}</dd>
              </div>
              <div>
                <dt>{t('tableSheet.total')}</dt>
                <dd>{formatPrice(table.total)}</dd>
              </div>
              <div>
                <dt>{t('tableSheet.status')}</dt>
                <dd>{t(`tables.status.${table.status}`)}</dd>
              </div>
            </dl>

            <ol className={styles.tickets}>
              {tickets.map((ticket) => (
                <li key={ticket._id} className={styles.ticket}>
                  <div className={styles.ticketTop}>
                    <h3 className={styles.ticketTitle}>{t('tables.round', { round: ticket.round })}</h3>
                    <span className={`${styles.badge} ${styles[ticket.status]}`}>{t(`tables.ticketStatus.${ticket.status}`)}</span>
                  </div>
                  <p className={styles.ticketMeta}>
                    <time dateTime={ticket.createdAt}>{formatTime(ticket.createdAt)}</time>
                    {ticket.waiter?.name && ` · ${ticket.waiter.name}`}
                  </p>

                  <ul className={styles.items}>
                    {ticket.items.map((item, index) => (
                      <li key={index} className={styles.item}>
                        <span className={styles.qty}>{item.qty}×</span>
                        <span className={styles.code}>{item.codeSnapshot}</span>
                        <span className={styles.name}>
                          {item.nameSnapshot}
                          {item.notes && <span className={styles.notes}>{item.notes}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {ticket.status === 'ready' && (
                    <button type="button" className={styles.serve} onClick={() => onServe(ticket)}>
                      <Icon name="check" size={18} />
                      {t('waiter.markServed')}
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}

        <div className={styles.actions}>
          <Link to={`/staff/waiter/tables/${table.number}/new`} className={styles.newTicket}>
            <span className={styles.plus} aria-hidden="true">+</span>
            {t('tableSheet.newTicket')}
          </Link>
          {!isFree && (
            <button type="button" className={styles.closeTable} onClick={() => onCloseTable(table)}>
              {t('tableSheet.closeTable')}
            </button>
          )}
        </div>
      </div>
    </dialog>
  )
}

export default TableSheet
