import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'
import api, { getErrorCode } from '../../../api/client.js'
import BookingMessage from '../../../components/BookingMessage/BookingMessage.jsx'
import ConfirmDialog from '../../../components/ConfirmDialog/ConfirmDialog.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import { formatDate } from '../../../utils/calendar.js'
import styles from './BookingCancelPage.module.css'

const RELOAD_CODES = ['RESERVATION_NOT_FOUND', 'RESERVATION_NOT_CANCELLABLE', 'RESERVATION_ALREADY_STARTED'] // the booking changed since the page opened: show where it stands now

// /book/cancel/:token: the link in the confirmation email. Opening it only reads the booking (GET); the button + dialog cancel it (POST)
const BookingCancelPage = () => {
  const { token } = useParams()
  const { lang, t, tError } = useLanguage()
  const [booking, setBooking] = useState(null) // { date, time, partySize, status, hasStarted }
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [cancelledNow, setCancelledNow] = useState(false) // "cancelled" by this visit, or before it

  useEffect(() => {
    let ignore = false

    api.get(`/reservations/cancel/${encodeURIComponent(token)}`)
      .then(({ data }) => {
        if (!ignore) setBooking(data)
      })
      .catch((err) => {
        if (!ignore) setError(err)
      })

    return () => {
      ignore = true
    }
  }, [token, attempt])

  const reload = () => {
    setBooking(null)
    setError(null)
    setAttempt((current) => current + 1)
  }

  const handleCancel = async () => {
    try {
      const { data } = await api.post(`/reservations/cancel/${encodeURIComponent(token)}`)
      setCancelledNow(true)
      setBooking((current) => ({ ...current, status: data.status }))
    } catch (err) {
      toast.error(tError(err))
      if (RELOAD_CODES.includes(getErrorCode(err))) reload()
    }
  }

  const backToMenu = { label: t('booking.backToMenu'), to: '/menu' }

  let content
  if (error) {
    content = getErrorCode(error) === 'RESERVATION_NOT_FOUND'
      ? (
        <BookingMessage
          key="invalid"
          title={t('bookingLink.invalid.title')}
          text={t('bookingLink.invalid.cancelText')}
          actions={[{ ...backToMenu, primary: true }]}
        />
      )
      : (
        <BookingMessage
          key={`error-${attempt}`}
          title={t('bookingLink.cancel.loadError')}
          text={tError(error)}
          actions={[{ label: t('menu.retry'), onClick: reload, primary: true }, backToMenu]}
        />
      )
  } else if (!booking) {
    content = (
      <LoadingState slowMessage="bookingLink.slow">
        <Skeleton height="20rem" radius="var(--radius-card)" className={styles.skeleton} />
      </LoadingState>
    )
  } else if (booking.status === 'cancelled') {
    const state = cancelledNow ? 'done' : 'already'
    content = (
      <BookingMessage
        key={state}
        title={t(`bookingLink.cancel.${state}.title`)}
        text={t(`bookingLink.cancel.${state}.text`)}
        booking={booking}
        actions={[{ label: t('bookingLink.bookAgain'), to: '/book', primary: true }, backToMenu]}
      />
    )
  } else if (booking.status !== 'confirmed') { // only confirmed bookings get this link: reached only if the data changed by hand
    content = (
      <BookingMessage
        key="not-cancellable"
        title={t('bookingLink.cancel.notCancellable')}
        text={t('errors.RESERVATION_NOT_CANCELLABLE')}
        booking={booking}
        actions={[backToMenu]}
      />
    )
  } else if (booking.hasStarted) {
    content = (
      <BookingMessage
        key="started"
        title={t('bookingLink.cancel.started.title')}
        text={t('bookingLink.cancel.started.text')}
        booking={booking}
        actions={[{ label: t('bookingLink.contacts'), to: '/info', primary: true }, backToMenu]}
      />
    )
  } else {
    const guests = booking.partySize === 1 ? t('booking.guestCountOne') : t('booking.guestCount', { count: booking.partySize })
    content = (
      <>
        <BookingMessage
          key="details"
          title={t('bookingLink.cancel.title')}
          text={t('bookingLink.cancel.text')}
          booking={booking}
          actions={[{ label: t('bookingLink.cancel.button'), onClick: () => setIsConfirmOpen(true), primary: true }, backToMenu]}
        />

        {isConfirmOpen && (
          <ConfirmDialog
            open
            destructive
            title={t('bookingLink.cancel.dialogTitle', { date: formatDate(booking.date, lang), time: booking.time })}
            message={t('bookingLink.cancel.dialogMessage', { guests })}
            confirmLabel={t('bookingLink.cancel.dialogConfirm')}
            cancelLabel={t('bookingLink.cancel.dialogKeep')}
            onConfirm={handleCancel}
            onClose={() => setIsConfirmOpen(false)}
          />
        )}
      </>
    )
  }

  return <div className={styles.page}>{content}</div>
}

export default BookingCancelPage
