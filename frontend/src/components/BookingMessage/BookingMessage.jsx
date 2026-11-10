import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router'
import useLanguage from '../../hooks/useLanguage.js'
import { formatDate } from '../../utils/calendar.js'
import styles from './BookingMessage.module.css'

/*
* Where a guest's booking stands: after the form, on the confirm link and on the cancel link.
* `booking` (optional) adds the date / time / guests summary. `actions`: [{ label, to }] for links, [{ label, onClick }] for buttons,
* `primary: true` for the main one. The title takes the focus when the card appears, so screen readers and the scroll position
* follow the change: give the card a new `key` for every state
*/
const BookingMessage = ({ title, text, booking, actions = [] }) => {
  const { lang, t } = useLanguage()
  const titleRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    titleRef.current.focus()
  }, [])

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <h1 id={titleId} ref={titleRef} className={styles.title} tabIndex={-1}>{title}</h1>
      {text && <p className={styles.text}>{text}</p>}

      {booking && (
        <dl className={styles.summary}>
          <div className={styles.summaryRow}>
            <dt>{t('booking.date')}</dt>
            <dd>{formatDate(booking.date, lang)}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>{t('booking.time')}</dt>
            <dd>{booking.time}</dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>{t('booking.partySize')}</dt>
            <dd>{booking.partySize}</dd>
          </div>
        </dl>
      )}

      {actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map(({ label, to, onClick, primary }) => {
            const className = `${styles.action} ${primary ? styles.primary : ''}`
            return to
              ? <Link key={label} to={to} className={className}>{label}</Link>
              : <button key={label} type="button" className={className} onClick={onClick}>{label}</button>
          })}
        </div>
      )}
    </section>
  )
}

export default BookingMessage
