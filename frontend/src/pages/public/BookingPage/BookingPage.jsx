import { useEffect, useState } from 'react'
import api from '../../../api/client.js'
import BookingForm from '../../../components/BookingForm/BookingForm.jsx'
import BookingMessage from '../../../components/BookingMessage/BookingMessage.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import styles from './BookingPage.module.css'

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
        {/* What happens next depends on the status the server chose */}
        <BookingMessage
          title={t(`booking.result.${booking.status}.title`)}
          text={t(`booking.result.${booking.status}.text`, { email: booking.email })}
          booking={booking}
          actions={[{ label: t('booking.backToMenu'), to: '/menu' }]}
        />
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
