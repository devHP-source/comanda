import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import api from '../../../api/client.js'
import BookingForm from '../../../components/BookingForm/BookingForm.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import { formatDate } from '../../../utils/calendar.js'
import styles from './BookingPage.module.css'

const BookingResult = ({ booking }) => { // What happens next depends on the status the server chose
  const { lang, t } = useLanguage()
  const titleRef = useRef(null)

  useEffect(() => { // the form is gone: screen readers and the scroll position move to the result
    titleRef.current.focus()
  }, [])

  return (
    <section className={styles.result} aria-labelledby="book-result">
      <h1 id="book-result" ref={titleRef} className={styles.resultTitle} tabIndex={-1}>
        {t(`booking.result.${booking.status}.title`)}
      </h1>
      <p className={styles.resultText}>{t(`booking.result.${booking.status}.text`, { email: booking.email })}</p>

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

      <Link to="/menu" className={styles.action}>{t('booking.backToMenu')}</Link>
    </section>
  )
}

// /book: loads the booking rules, then shows the form or, once sent, what happens next
const BookingPage = () => {
  const { t } = useLanguage()
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [booking, setBooking] = useState(null)

  useEffect(() => {
    let ignore = false

    api.get('/settings/public')
      .then(({ data }) => {
        if (!ignore) setSettings(data)
      })
      .catch((err) => {
        if (!ignore) setError(err)
      })

    return () => {
      ignore = true
    }
  }, [attempt])

  const handleRetry = () => {
    setError(null)
    setAttempt((current) => current + 1)
  }

  if (booking) {
    return (
      <div className={styles.page}>
        <BookingResult booking={booking} />
      </div>
    )
  }

  let content
  if (settings) {
    content = <BookingForm settings={settings} onBooked={setBooking} />
  } else if (error) {
    content = (
      <div className={styles.loadError} role="alert">
        <p>{t('booking.loadError')}</p>
        <button type="button" className={styles.action} onClick={handleRetry}>{t('menu.retry')}</button>
      </div>
    )
  } else {
    content = (
      <LoadingState slowMessage="booking.slow">
        <div className={styles.skeleton}>
          <Skeleton height="16rem" radius="var(--radius-card)" />
          <Skeleton height="24rem" radius="var(--radius-card)" />
        </div>
      </LoadingState>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>{t('booking.eyebrow')}</p>
        <h1 className={styles.title}>{t('booking.title')}</h1>
        <p className={styles.lead}>{t('booking.lead')}</p>
      </section>

      {content}
    </div>
  )
}

export default BookingPage
