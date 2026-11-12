import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import api, { getErrorCode } from '../../api/client.js'
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog.jsx'
import Icon from '../Icon/Icon.jsx'
import LoadingState from '../LoadingState/LoadingState.jsx'
import Skeleton from '../Skeleton/Skeleton.jsx'
import Turnstile from '../Turnstile/Turnstile.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import { addDays, formatDate } from '../../utils/calendar.js'
import { romeNow } from '../../utils/kitchenStatus.js'
import { DEFAULT_REGION, OTHER_REGION, phoneOptions, toE164 } from '../../utils/phone.js'
import styles from './BookingForm.module.css'

const EMPTY_FORM = {
  partySize: '2',
  date: '',
  time: '',
  name: '',
  surname: '',
  email: '',
  region: DEFAULT_REGION,
  phone: '',
  notes: '',
}

const SERVER_FIELDS = ['name', 'surname', 'email', 'phone', 'notes'] // the fields of a VALIDATION_FAILED that have a place on the form
const STALE_SLOT_CODES = ['BOOKING_IN_PAST', 'INVALID_TIME', 'RESTAURANT_CLOSED', 'BOOKING_TOO_FAR'] // the list on screen is out of date
const SLOT_SKELETONS = ['a', 'b', 'c', 'd', 'e', 'f']

const requiredMark = <span aria-hidden="true"> *</span>

const BookingForm = ({ settings, onBooked }) => {
  const { lang, t, tError } = useLanguage()
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [slotResult, setSlotResult] = useState(null) // { key, slots } or { key, error }
  const [slotAttempt, setSlotAttempt] = useState(0)
  const [nearestTimes, setNearestTimes] = useState(null) // after SLOT_FULL: the closest free times
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const [captchaKey, setCaptchaKey] = useState(0) // a new key = a new widget = a new token
  const timeRef = useRef(null)
  const phoneRef = useRef(null)

  const { date, partySize } = form
  const slotKey = `${date}|${partySize}|${slotAttempt}`

  useEffect(() => { // ignore: a late answer for a previous date or party size never replaces the current one
    if (!date) return undefined
    let ignore = false

    api.get('/reservations/slots', { params: { date, partySize } })
      .then(({ data }) => {
        if (!ignore) setSlotResult({ key: slotKey, slots: data.slots })
      })
      .catch((error) => {
        if (!ignore) setSlotResult({ key: slotKey, error })
      })

    return () => {
      ignore = true
    }
  }, [date, partySize, slotKey])

  const prefixOptions = useMemo(() => phoneOptions(lang), [lang])

  const currentResult = slotResult?.key === slotKey ? slotResult : null
  const slots = currentResult?.slots
  const selectedTime = slots?.includes(form.time) ? form.time : '' // a time that is no longer free stops being selected
  const guests = Number(partySize)
  const isBigGroup = guests > settings.maxPartySizeAuto
  const isOtherRegion = form.region === OTHER_REGION
  const today = romeNow().date

  const clearFieldError = (field) => setFieldErrors((current) => (current[field] ? { ...current, [field]: false } : current))

  const handleChange = ({ target: { name, value } }) => {
    setForm((current) => ({ ...current, [name]: value }))
    clearFieldError(name === 'region' ? 'phone' : name)
    if (['date', 'partySize', 'time'].includes(name)) setNearestTimes(null)
  }

  const handleChooseNearest = (time) => {
    setForm((current) => ({ ...current, time }))
    clearFieldError('time')
    setNearestTimes(null)
  }

  const handleSubmit = (event) => { // Native validation has already passed: what's left are the checks the browser can't do
    event.preventDefault()

    if (!selectedTime) { // no radio to validate when the day has no free times
      setFieldErrors((current) => ({ ...current, time: true }))
      timeRef.current.focus()
      return
    }

    if (!toE164(form.region, form.phone)) {
      setFieldErrors((current) => ({ ...current, phone: true }))
      phoneRef.current.focus()
      return
    }

    setIsConfirmOpen(true)
  }

  const handleBookingError = (error) => {
    const code = getErrorCode(error)

    if (code === 'SLOT_FULL') { // shown by the form with the nearest times, no toast
      setNearestTimes(error.response.data.errors?.slots ?? [])
      setSlotAttempt((current) => current + 1)
      return
    }

    toast.error(tError(error))
    if (STALE_SLOT_CODES.includes(code)) setSlotAttempt((current) => current + 1)

    if (code === 'VALIDATION_FAILED') {
      const invalid = Object.keys(error.response.data.errors ?? {}).filter((field) => SERVER_FIELDS.includes(field))
      setFieldErrors((current) => ({ ...current, ...Object.fromEntries(invalid.map((field) => [field, true])) }))
    }
  }

  const handleConfirm = async () => {
    try {
      const { data } = await api.post('/reservations', {
        name: form.name.trim(),
        surname: form.surname.trim(),
        email: form.email.trim(),
        phone: toE164(form.region, form.phone),
        date,
        time: selectedTime,
        partySize: guests,
        notes: form.notes.trim(),
        lang,
        turnstileToken: captchaToken,
      })
      onBooked(data)
    } catch (error) {
      setCaptchaToken(null)
      setCaptchaKey((current) => current + 1) // the token works once, and the server may already have used it
      handleBookingError(error)
    }
  }

  const fieldProps = (field) => ({
    name: field,
    value: form[field],
    onChange: handleChange,
    'aria-invalid': Boolean(fieldErrors[field]),
    'aria-describedby': fieldErrors[field] ? `book-${field}-error` : undefined,
  })

  const fieldError = (field, message = field) => fieldErrors[field] && (
    <p id={`book-${field}-error`} className={styles.error}>{t(`booking.fieldErrors.${message}`)}</p>
  )

  const renderTimes = () => {
    if (!date) return <p className={styles.hint}>{t('booking.pickDateFirst')}</p>

    if (!currentResult) {
      return (
        <LoadingState quiet>
          <div className={styles.slots}>
            {SLOT_SKELETONS.map((key) => <Skeleton key={key} height="var(--tap-min)" radius="var(--radius-pill)" />)}
          </div>
        </LoadingState>
      )
    }

    if (currentResult.error) {
      const canRetry = !currentResult.error.response || currentResult.error.response.status >= 500

      return (
        <div className={styles.slotMessage} role="alert">
          <p>{tError(currentResult.error)}</p>
          {canRetry && (
            <button type="button" className={styles.secondary} onClick={() => setSlotAttempt((current) => current + 1)}>
              {t('menu.retry')}
            </button>
          )}
        </div>
      )
    }

    if (slots.length === 0) return <p className={styles.slotMessage} role="status">{t('booking.noSlots')}</p>

    return (
      <div className={styles.slots}>
        {slots.map((slot) => (
          <label key={slot} className={styles.slot}>
            <input
              type="radio"
              name="time"
              value={slot}
              className={`visually-hidden ${styles.slotInput}`}
              required
              checked={selectedTime === slot}
              onChange={handleChange}
            />
            <span className={styles.slotLabel}>{slot}</span>
          </label>
        ))}
      </div>
    )
  }

  const guestsText = t(guests === 1 ? 'booking.guestCountOne' : 'booking.guestCount', { count: guests })

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <p className={styles.legend}>{t('booking.requiredLegend')}</p>

      <section className={styles.card} aria-labelledby="book-when">
        <h2 id="book-when" className={styles.cardTitle}>{t('booking.whenTitle')}</h2>

        <div className={styles.twoColumns}>
          <label className={styles.field}>
            <span className={styles.label}>{t('booking.partySize')}{requiredMark}</span>
            <input
              className={styles.input}
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              required
              {...fieldProps('partySize')}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('booking.date')}{requiredMark}</span>
            <input
              className={styles.input}
              type="date"
              min={today}
              max={addDays(today, settings.maxDaysAhead)}
              required
              {...fieldProps('date')}
            />
          </label>
        </div>

        {isBigGroup && (
          <p className={styles.note} role="status">{t('booking.bigGroupNote', { max: settings.maxPartySizeAuto })}</p>
        )}

        <fieldset
          ref={timeRef}
          className={styles.timeGroup}
          tabIndex={-1}
          aria-describedby={fieldErrors.time ? 'book-time-error' : undefined}
        >
          <legend className={styles.label}>{t('booking.time')}{requiredMark}</legend>
          {renderTimes()}
          {fieldError('time')}
        </fieldset>
      </section>

      <section className={styles.card} aria-labelledby="book-contact">
        <h2 id="book-contact" className={styles.cardTitle}>{t('booking.contactTitle')}</h2>

        <div className={styles.twoColumns}>
          <div className={styles.field}>
            <label htmlFor="book-name" className={styles.label}>{t('booking.name')}{requiredMark}</label>
            <input id="book-name" className={styles.input} type="text" autoComplete="given-name" maxLength={60} required {...fieldProps('name')} />
            {fieldError('name')}
          </div>

          <div className={styles.field}>
            <label htmlFor="book-surname" className={styles.label}>{t('booking.surname')}{requiredMark}</label>
            <input id="book-surname" className={styles.input} type="text" autoComplete="family-name" maxLength={60} required {...fieldProps('surname')} />
            {fieldError('surname')}
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="book-email" className={styles.label}>{t('booking.email')}{requiredMark}</label>
          <input id="book-email" className={styles.input} type="email" inputMode="email" autoComplete="email" maxLength={254} required {...fieldProps('email')} />
          {fieldError('email')}
        </div>

        <div className={styles.field}>
          <label htmlFor="book-phone" className={styles.label}>{t('booking.phone')}{requiredMark}</label>
          <div className={styles.phoneRow}>
            <span className={styles.selectWrap}>
              <select
                className={`${styles.input} ${styles.select}`}
                name="region"
                aria-label={t('booking.phonePrefix')}
                autoComplete="off"
                value={form.region}
                onChange={handleChange}
              >
                {prefixOptions.map(({ region, label }) => (
                  <option key={region} value={region}>{label}</option>
                ))}
                <option value={OTHER_REGION}>{t('booking.phoneOther')}</option>
              </select>
              <Icon name="chevron" size={18} className={styles.selectChevron} />
            </span>
            <input
              id="book-phone"
              ref={phoneRef}
              className={styles.input}
              type="tel"
              inputMode="tel"
              autoComplete={isOtherRegion ? 'tel' : 'tel-national'}
              required
              {...fieldProps('phone')}
              aria-describedby={fieldErrors.phone ? 'book-phone-error' : isOtherRegion ? 'book-phone-hint' : undefined}
            />
          </div>
          {isOtherRegion && <p id="book-phone-hint" className={styles.hint}>{t('booking.phoneOtherHint')}</p>}
          {fieldError('phone', isOtherRegion ? 'phoneOther' : 'phone')}
        </div>

        <div className={styles.field}>
          <label htmlFor="book-notes" className={styles.label}>{t('booking.notes')}</label>
          <textarea
            id="book-notes"
            className={`${styles.input} ${styles.textarea}`}
            maxLength={500}
            rows={3}
            {...fieldProps('notes')}
            aria-describedby={fieldErrors.notes ? 'book-notes-error' : 'book-notes-hint'}
          />
          <p id="book-notes-hint" className={styles.hint}>{t('booking.notesHint')}</p>
          {fieldError('notes')}
        </div>
      </section>

      {nearestTimes && (
        <div className={styles.slotFull} role="alert">
          <p>{t(nearestTimes.length > 0 ? 'booking.slotFull.nearest' : 'booking.slotFull.none')}</p>
          {nearestTimes.length > 0 && (
            <div className={styles.nearestTimes}>
              {nearestTimes.map((time) => (
                <button key={time} type="button" className={styles.secondary} onClick={() => handleChooseNearest(time)}>
                  {time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Turnstile key={captchaKey} onToken={setCaptchaToken} />
      {!captchaToken && <p id="book-captcha-hint" className={styles.captchaHint}>{t('booking.captcha.waiting')}</p>}

      <button
        type="submit"
        className={styles.submit}
        disabled={!captchaToken}
        aria-describedby={captchaToken ? undefined : 'book-captcha-hint'}
      >
        {t(isBigGroup ? 'booking.submitGroup' : 'booking.submit')}
      </button>
      <p className={styles.privacy}>{t('booking.privacy')}</p>

      {isConfirmOpen && (
        <ConfirmDialog
          open
          title={t(isBigGroup ? 'booking.confirm.titleGroup' : 'booking.confirm.title', { date: formatDate(date, lang), time: selectedTime })}
          message={t(isBigGroup ? 'booking.confirm.messageGroup' : 'booking.confirm.message', { guests: guestsText, email: form.email.trim() })}
          onConfirm={handleConfirm}
          onClose={() => setIsConfirmOpen(false)}
        />
      )}
    </form>
  )
}

export default BookingForm
