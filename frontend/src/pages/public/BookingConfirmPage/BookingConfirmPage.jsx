import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import api, { getErrorCode } from '../../../api/client.js'
import BookingMessage from '../../../components/BookingMessage/BookingMessage.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import styles from './BookingConfirmPage.module.css'

const canRetry = (error) => !error.response || error.response.status >= 500 // offline, Render waking up, server error: the same link may work in a moment

// /book/confirm/:token: the link in the verify email. Opening it confirms the booking (GET /verify/:token)
const BookingConfirmPage = () => {
  const { token } = useParams()
  const { t, tError } = useLanguage()
  const [result, setResult] = useState(null) // { booking } or { error }
  const [attempt, setAttempt] = useState(0) // "Riprova" bumps it
  const requestRef = useRef(null) // { key, promise }

  useEffect(() => {
    let ignore = false

    // StrictMode runs every effect twice in development: the second run reuses the request instead of sending another (one confirmation, one email)
    const key = `${token}:${attempt}`
    if (requestRef.current?.key !== key) {
      requestRef.current = { key, promise: api.get(`/reservations/verify/${encodeURIComponent(token)}`) }
    }

    requestRef.current.promise
      .then(({ data }) => {
        if (!ignore) setResult({ booking: data })
      })
      .catch((error) => {
        if (!ignore) setResult({ error })
      })

    return () => {
      ignore = true
    }
  }, [token, attempt])

  const handleRetry = () => {
    setResult(null)
    setAttempt((current) => current + 1)
  }

  const bookAgain = { label: t('bookingLink.bookAgain'), to: '/book', primary: true }
  const backToMenu = { label: t('booking.backToMenu'), to: '/menu' }

  let content
  if (!result) {
    content = (
      <LoadingState slowMessage="bookingLink.slow">
        <Skeleton height="20rem" radius="var(--radius-card)" className={styles.skeleton} />
      </LoadingState>
    )
  } else if (result.booking) {
    content = (
      <BookingMessage
        key="confirmed"
        title={t('bookingLink.confirmed.title')}
        text={t('bookingLink.confirmed.text')}
        booking={result.booking}
        actions={[{ ...backToMenu, primary: true }]}
      />
    )
  } else {
    const { error } = result
    const code = getErrorCode(error)

    if (code === 'SLOT_FULL') { // the restaurant filled up while the email was unread: this booking holds nothing
      const slots = error.response.data.errors?.slots ?? []
      content = (
        <BookingMessage
          key="slot-full"
          title={t('bookingLink.slotFull.title')}
          text={slots.length > 0
            ? t('bookingLink.slotFull.nearest', { times: slots.join(' · ') })
            : t('bookingLink.slotFull.none')}
          actions={[bookAgain, backToMenu]}
        />
      )
    } else if (code === 'RESERVATION_NOT_FOUND') { // wrong, expired (30 minutes) or cancelled
      content = (
        <BookingMessage
          key="invalid"
          title={t('bookingLink.invalid.title')}
          text={t('bookingLink.invalid.confirmText')}
          actions={[bookAgain, backToMenu]}
        />
      )
    } else if (canRetry(error)) {
      content = (
        <BookingMessage
          key={`error-${attempt}`}
          title={t('bookingLink.confirmError.title')}
          text={tError(error)}
          actions={[{ label: t('menu.retry'), onClick: handleRetry, primary: true }, backToMenu]}
        />
      )
    } else { // the booking can no longer be confirmed as it is (time already passed, day closed meanwhile)
      content = (
        <BookingMessage
          key="refused"
          title={t('bookingLink.refused.title')}
          text={tError(error)}
          actions={[bookAgain, backToMenu]}
        />
      )
    }
  }

  return <div className={styles.page}>{content}</div>
}

export default BookingConfirmPage
