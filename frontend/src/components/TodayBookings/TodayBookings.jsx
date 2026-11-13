import { useCallback, useState } from 'react'
import api from '../../api/client.js'
import useLanguage from '../../hooks/useLanguage.js'
import usePolling from '../../hooks/usePolling.js'
import { romeNow } from '../../utils/restaurantClock.js'
import LoadingState from '../LoadingState/LoadingState.jsx'
import Skeleton from '../Skeleton/Skeleton.jsx'
import styles from './TodayBookings.module.css'

const POLL_MS = 60000 // bookings change rarely during service: once a minute is enough
const SKELETON_ROWS = 3

const BookingRowSkeleton = () => (
  <li className={styles.row}>
    <Skeleton width="3.5rem" height="1.75rem" />
    <span className={styles.skeletonText}>
      <Skeleton width="60%" height="1.1rem" />
      <Skeleton width="45%" height="0.9rem" />
      <Skeleton width="40%" height="0.9rem" />
    </span>
  </li>
)

// Waiter screen, read-only: today's confirmed bookings (the server picks today in Europe/Rome and leaves the email out), soonest first
const TodayBookings = () => {
  const { t } = useLanguage()
  const [bookings, setBookings] = useState(null) // null until the first answer
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/reservations', { params: { limit: 100 } }) // a waiter always gets today's confirmed bookings, whatever the filters
      setBookings(data.data)
      setError(false)
    } catch {
      setError(true) // keep the last list on screen
    }
  }, [])

  usePolling(load, POLL_MS)

  const handleRetry = () => {
    setError(false)
    load()
  }

  const now = romeNow().time // the page re-renders every 5 s (tables polling), so "past" stays current

  let content
  if (!bookings && error) {
    content = (
      <div className={styles.loadError} role="alert">
        <p>{t('todayBookings.loadError')}</p>
        <button type="button" className={styles.retry} onClick={handleRetry}>{t('menu.retry')}</button>
      </div>
    )
  } else if (!bookings) {
    content = (
      <LoadingState quiet>
        <ul className={styles.list}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => <BookingRowSkeleton key={index} />)}
        </ul>
      </LoadingState>
    )
  } else if (bookings.length === 0) {
    content = <p className={styles.empty}>{t('todayBookings.empty')}</p>
  } else {
    content = (
      <ul className={styles.list}>
        {bookings.map((booking) => {
          const isPast = booking.time <= now // "HH:mm" strings compare in time order
          const name = `${booking.name} ${booking.surname}`
          return (
            <li key={booking._id} className={`${styles.row} ${isPast ? styles.past : ''}`}>
              <p className={styles.time}>
                {booking.time}
                {isPast && <span className="visually-hidden"> · {t('todayBookings.past')}</span>}
              </p>
              <div className={styles.text}>
                <h3 className={styles.name}>{name}</h3>
                <p className={styles.party}>
                  {booking.partySize === 1 ? t('booking.guestCountOne') : t('booking.guestCount', { count: booking.partySize })}
                  {' · '}
                  {booking.tablesNeeded === 1 ? t('adminReservations.tablesOne') : t('adminReservations.tables', { count: booking.tablesNeeded })}
                </p>
                <a href={`tel:${booking.phone}`} className={styles.phone} aria-label={t('adminReservations.callLabel', { name })}>
                  {booking.phone}
                </a>
                {booking.notes && <p className={styles.notes}>{booking.notes}</p>}
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <section aria-labelledby="today-bookings-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>{t('todayBookings.kicker')}</p>
          <h2 id="today-bookings-title" className={styles.title}>{t('todayBookings.title')}</h2>
        </div>
        {bookings && bookings.length > 0 && (
          <span className={styles.count}>
            {bookings.length === 1 ? t('todayBookings.countOne') : t('todayBookings.count', { count: bookings.length })}
          </span>
        )}
      </div>

      {error && bookings && <p className={styles.stale} role="status">{t('todayBookings.stale')}</p>}

      {content}
    </section>
  )
}

export default TodayBookings
