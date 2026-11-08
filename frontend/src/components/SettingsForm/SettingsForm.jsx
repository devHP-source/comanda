import { useRef, useState } from 'react'
import { toast } from 'sonner'
import api, { getErrorCode } from '../../api/client.js'
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import { WEEK, formatDate, weekdayName } from '../../utils/calendar.js'
import { romeNow } from '../../utils/kitchenStatus.js'
import styles from './SettingsForm.module.css'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/ // "HH:mm": such strings compare correctly as text
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const INTEGER_PATTERN = /^\d{1,3}$/

const TIME_FIELDS = ['openingTime', 'closingTime', 'lastBookingTime']
const NUMBER_FIELDS = { // same limits as the server
  slotMinutes: { min: 5, max: 120 },
  avgDurationMinutes: { min: 15, max: 300 },
  tableCount: { min: 1, max: 200 },
  seatsPerTable: { min: 1, max: 20 },
  maxOnlineTables: { min: 0, max: 200 },
  maxPartySizeAuto: { min: 1, max: 50 },
  maxDaysAhead: { min: 1, max: 365 },
}

// Form sections, in screen order: the confirm dialog names the ones that changed
const SECTIONS = {
  hours: ['openingTime', 'closingTime'],
  bookings: ['lastBookingTime', 'slotMinutes', 'avgDurationMinutes', 'maxPartySizeAuto', 'maxDaysAhead'],
  room: ['tableCount', 'seatsPerTable', 'maxOnlineTables'],
  closures: ['closedDays', 'closedDates'],
}
const FIELDS = Object.values(SECTIONS).flat()
const FIELD_ORDER = [...FIELDS, 'newClosedDate'] // the first field with an error gets the focus

const FIELD_MESSAGES = {
  openingTime: 'settingsForm.errors.time',
  closingTime: 'settingsForm.errors.closingTime',
  lastBookingTime: 'settingsForm.errors.lastBookingTime',
  maxOnlineTables: 'settingsForm.errors.maxOnlineTables',
  closedDays: 'settingsForm.errors.invalid',
  closedDates: 'settingsForm.errors.invalid',
}

const parseInteger = (text) => (INTEGER_PATTERN.test(text.trim()) ? Number(text.trim()) : null)

const fromSettings = (settings) => { // API document --> form values (numbers as text, like every input)
  const values = { closedDays: [...settings.closedDays], closedDates: [...settings.closedDates].sort(), newClosedDate: '' }
  for (const field of TIME_FIELDS) values[field] = settings[field]
  for (const field of Object.keys(NUMBER_FIELDS)) values[field] = String(settings[field])
  return values
}

const toBody = (values) => { // form values --> what PUT /api/settings expects
  const body = {
    closedDays: [...values.closedDays].sort((a, b) => a - b),
    closedDates: [...values.closedDates].sort(),
  }
  for (const field of TIME_FIELDS) body[field] = values[field]
  for (const field of Object.keys(NUMBER_FIELDS)) body[field] = parseInteger(values[field])
  return body
}

const changedFields = (values, initial) => { // only these are sent: "030" and "30" are the same value
  const next = toBody(values)
  const before = toBody(initial)
  return FIELDS.filter((field) => JSON.stringify(next[field]) !== JSON.stringify(before[field]))
}

const validate = (values) => { // same rules as the Settings model, so the server rarely has to refuse
  const errors = {}
  for (const field of TIME_FIELDS) {
    if (!TIME_PATTERN.test(values[field])) errors[field] = 'settingsForm.errors.time'
  }

  const { openingTime, closingTime, lastBookingTime } = values
  if (!errors.openingTime && !errors.closingTime) {
    if (closingTime <= openingTime) errors.closingTime = FIELD_MESSAGES.closingTime
    else if (!errors.lastBookingTime && (lastBookingTime <= openingTime || lastBookingTime > closingTime)) {
      errors.lastBookingTime = FIELD_MESSAGES.lastBookingTime
    }
  }

  for (const [field, { min, max }] of Object.entries(NUMBER_FIELDS)) {
    const number = parseInteger(values[field])
    if (number === null || number < min || number > max) errors[field] = FIELD_MESSAGES[field] ?? 'settingsForm.errors.number'
  }

  const tables = parseInteger(values.tableCount)
  if (!errors.tableCount && !errors.maxOnlineTables && parseInteger(values.maxOnlineTables) > tables) {
    errors.maxOnlineTables = FIELD_MESSAGES.maxOnlineTables
  }

  if (values.newClosedDate) errors.newClosedDate = 'settingsForm.errors.dateNotAdded' // typed but never added: don't lose it silently
  return errors
}

const serverFieldErrors = (err) => { // a refused save --> messages under the fields concerned ("closedDays.0" --> closedDays)
  if (getErrorCode(err) !== 'VALIDATION_FAILED') return {}
  const errors = {}
  for (const path of Object.keys(err.response.data.errors ?? {})) {
    const field = path.split('.')[0]
    if (FIELDS.includes(field)) errors[field] = FIELD_MESSAGES[field] ?? 'settingsForm.errors.number'
  }
  return errors
}

const firstErrorField = (errors) => FIELD_ORDER.find((field) => errors[field])

const fieldId = (field) => {
  if (field === 'closedDays') return `settings-closedDays-${WEEK[0]}`
  if (field === 'closedDates') return 'settings-newClosedDate'
  return `settings-${field}`
}

const focusField = (field) => document.getElementById(fieldId(field))?.focus()

// Admin settings: opening hours, online bookings, room size, closures. Asks before saving and sends only what changed
const SettingsForm = ({ settings }) => {
  const { t, tError, lang } = useLanguage()
  const pendingFocusRef = useRef(null) // field to focus once the confirm dialog has closed
  const [initial, setInitial] = useState(() => fromSettings(settings)) // last saved values
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({}) // field --> i18n key
  const [pendingChanges, setPendingChanges] = useState(null) // changed fields waiting for the confirm dialog

  const today = romeNow().date // the restaurant's day: a closure can't be added in the past
  const changed = changedFields(values, initial)
  const isDirty = changed.length > 0 || values.newClosedDate !== ''

  const clearError = (...fields) => {
    setErrors((current) => {
      if (!fields.some((field) => current[field])) return current
      const next = { ...current }
      for (const field of fields) delete next[field]
      return next
    })
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    clearError(name)
  }

  const toggleClosedDay = (weekday) => {
    setValues((current) => ({
      ...current,
      closedDays: current.closedDays.includes(weekday)
        ? current.closedDays.filter((day) => day !== weekday)
        : [...current.closedDays, weekday],
    }))
    clearError('closedDays')
  }

  const addClosedDate = () => {
    const date = values.newClosedDate
    let error = null
    if (!DATE_PATTERN.test(date)) error = 'settingsForm.errors.dateInvalid'
    else if (date < today) error = 'settingsForm.errors.datePast'
    else if (values.closedDates.includes(date)) error = 'settingsForm.errors.dateTaken'

    if (error) {
      setErrors((current) => ({ ...current, newClosedDate: error }))
      focusField('newClosedDate')
      return
    }
    setValues((current) => ({ ...current, closedDates: [...current.closedDates, date].sort(), newClosedDate: '' }))
    clearError('newClosedDate', 'closedDates')
  }

  const removeClosedDate = (date) => {
    setValues((current) => ({ ...current, closedDates: current.closedDates.filter((item) => item !== date) }))
    clearError('closedDates')
    focusField('newClosedDate') // the removed button is gone: keep the focus inside the section
  }

  const handleDateKeyDown = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault() // Enter adds the date instead of submitting the whole form
    addClosedDate()
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    const field = firstErrorField(found)
    if (field) {
      focusField(field)
      return
    }
    if (changed.length === 0) {
      toast(t('settingsForm.noChanges'))
      return
    }
    setPendingChanges(changed)
  }

  const handleReset = () => {
    setValues(initial)
    setErrors({})
  }

  const save = async () => {
    const next = toBody(values)
    const body = {}
    for (const field of pendingChanges) body[field] = next[field]

    try {
      const { data } = await api.put('/settings', body)
      const saved = fromSettings(data)
      setInitial(saved)
      setValues(saved)
      setErrors({})
      toast.success(t('settingsForm.saved'))
    } catch (err) {
      toast.error(tError(err))
      const found = serverFieldErrors(err)
      setErrors(found)
      pendingFocusRef.current = firstErrorField(found)
    }
  }

  const handleConfirmClose = () => { // runs after the dialog has given the focus back, so this focus wins
    setPendingChanges(null)
    const field = pendingFocusRef.current
    pendingFocusRef.current = null
    if (field) focusField(field)
  }

  const errorText = (field) => t(errors[field], { ...NUMBER_FIELDS[field], tables: values.tableCount.trim() })

  const describedBy = (field, hasHint) => [
    hasHint && `settings-${field}-hint`,
    errors[field] && `settings-${field}-error`,
  ].filter(Boolean).join(' ') || undefined

  const fieldMessages = (field, hasHint) => (
    <>
      {hasHint && <p id={`settings-${field}-hint`} className={styles.hint}>{t(`settingsForm.hints.${field}`)}</p>}
      {errors[field] && <p id={`settings-${field}-error`} className={styles.error}>{errorText(field)}</p>}
    </>
  )

  const requiredMark = <span className={styles.requiredMark} aria-hidden="true"> *</span>

  const inputField = (field, { hint = false } = {}) => {
    const isTime = TIME_FIELDS.includes(field)
    return (
      <div className={styles.field}>
        <label htmlFor={`settings-${field}`} className={styles.label}>
          {t(`settingsForm.fields.${field}`)}{requiredMark}
        </label>
        <input
          id={`settings-${field}`}
          name={field}
          value={values[field]}
          onChange={handleChange}
          className={`${styles.input} ${isTime ? styles.timeInput : styles.numberInput}`}
          required
          aria-invalid={Boolean(errors[field])}
          aria-describedby={describedBy(field, hint)}
          {...(isTime ? { type: 'time' } : { inputMode: 'numeric', maxLength: 3, autoComplete: 'off' })}
        />
        {fieldMessages(field, hint)}
      </div>
    )
  }

  // Live summary of the room: only when the three numbers make sense together
  const tables = parseInteger(values.tableCount)
  const seats = parseInteger(values.seatsPerTable)
  const online = parseInteger(values.maxOnlineTables)
  const roomSummary = tables && seats && online !== null && online <= tables
    ? t('settingsForm.roomSummary', {
      tables,
      seats,
      guests: tables * seats,
      online,
      onlineSeats: online * seats,
      walkIn: tables - online,
    })
    : null

  const sectionNames = pendingChanges
    ? Object.keys(SECTIONS)
      .filter((section) => SECTIONS[section].some((field) => pendingChanges.includes(field)))
      .map((section) => t(`settingsForm.sections.${section}`))
    : []
  const sectionList = new Intl.ListFormat(lang, { type: 'conjunction' }).format(sectionNames)

  const hasErrors = Object.keys(errors).length > 0

  return (
    <>
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <p className={styles.legend}>{t('dishForm.requiredLegend')}</p>
        {hasErrors && <p className={styles.summary} role="alert">{t('dishForm.errorSummary')}</p>}

        <section className={styles.card} aria-labelledby="settings-section-hours">
          <h2 id="settings-section-hours" className={styles.cardTitle}>{t('settingsForm.sections.hours')}</h2>
          <p className={styles.hint}>{t('settingsForm.hints.hours')}</p>
          <div className={styles.grid}>
            {inputField('openingTime')}
            {inputField('closingTime')}
          </div>
        </section>

        <section className={styles.card} aria-labelledby="settings-section-bookings">
          <h2 id="settings-section-bookings" className={styles.cardTitle}>{t('settingsForm.sections.bookings')}</h2>
          <div className={styles.grid}>
            {inputField('lastBookingTime', { hint: true })}
            {inputField('slotMinutes', { hint: true })}
            {inputField('avgDurationMinutes', { hint: true })}
            {inputField('maxPartySizeAuto', { hint: true })}
            {inputField('maxDaysAhead', { hint: true })}
          </div>
        </section>

        <section className={styles.card} aria-labelledby="settings-section-room">
          <h2 id="settings-section-room" className={styles.cardTitle}>{t('settingsForm.sections.room')}</h2>
          <div className={styles.grid}>
            {inputField('tableCount')}
            {inputField('seatsPerTable')}
            {inputField('maxOnlineTables', { hint: true })}
          </div>
          {roomSummary && <p className={styles.roomSummary}>{roomSummary}</p>}
        </section>

        <section className={styles.card} aria-labelledby="settings-section-closures">
          <h2 id="settings-section-closures" className={styles.cardTitle}>{t('settingsForm.sections.closures')}</h2>

          <fieldset className={styles.group} aria-describedby={describedBy('closedDays', true)}>
            <legend className={styles.label}>{t('settingsForm.fields.closedDays')}</legend>
            {fieldMessages('closedDays', true)}
            <div className={styles.days}>
              {WEEK.map((weekday) => (
                <label key={weekday} className={styles.day}>
                  <input
                    id={`settings-closedDays-${weekday}`}
                    type="checkbox"
                    className={styles.checkbox}
                    checked={values.closedDays.includes(weekday)}
                    onChange={() => toggleClosedDay(weekday)}
                  />
                  {weekdayName(weekday, lang)}
                </label>
              ))}
            </div>
          </fieldset>

          <div className={styles.group}>
            <p className={styles.label} id="settings-closedDates-label">{t('settingsForm.fields.closedDates')}</p>
            {fieldMessages('closedDates', true)}

            {values.closedDates.length === 0 ? (
              <p className={styles.noDates}>{t('settingsForm.noClosedDates')}</p>
            ) : (
              <ul className={styles.dates} aria-labelledby="settings-closedDates-label">
                {values.closedDates.map((date) => {
                  const label = formatDate(date, lang)
                  return (
                    <li key={date} className={`${styles.date} ${date < today ? styles.datePast : ''}`}>
                      <time dateTime={date}>{label}</time>
                      {date < today && <span className={styles.pastTag}>{t('settingsForm.past')}</span>}
                      <button
                        type="button"
                        className={styles.removeDate}
                        aria-label={t('settingsForm.removeDate', { date: label })}
                        onClick={() => removeClosedDate(date)}
                      >
                        {t('settingsForm.remove')}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className={styles.addDate}>
              <div className={styles.field}>
                <label htmlFor="settings-newClosedDate" className={styles.label}>{t('settingsForm.fields.newClosedDate')}</label>
                <input
                  id="settings-newClosedDate"
                  name="newClosedDate"
                  type="date"
                  min={today}
                  value={values.newClosedDate}
                  onChange={handleChange}
                  onKeyDown={handleDateKeyDown}
                  className={`${styles.input} ${styles.dateInput}`}
                  aria-invalid={Boolean(errors.newClosedDate)}
                  aria-describedby={describedBy('newClosedDate', false)}
                />
                {fieldMessages('newClosedDate', false)}
              </div>
              <button type="button" className={styles.addButton} onClick={addClosedDate}>{t('settingsForm.addDate')}</button>
            </div>
          </div>
        </section>

        <div className={styles.actions}>
          {isDirty && (
            <button type="button" className={styles.reset} onClick={handleReset}>{t('settingsForm.reset')}</button>
          )}
          <button type="submit" className={styles.submit}>{t('settingsForm.save')}</button>
        </div>
      </form>

      <ConfirmDialog
        open={Boolean(pendingChanges)}
        title={t('settingsForm.confirm.title', { sections: sectionList })}
        message={t('settingsForm.confirm.message')}
        confirmLabel={t('settingsForm.save')}
        onConfirm={save}
        onClose={handleConfirmClose}
      />
    </>
  )
}

export default SettingsForm
