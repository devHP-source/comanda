import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import api from '../../../api/client.js'
import ConfirmDialog from '../../../components/ConfirmDialog/ConfirmDialog.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Pagination from '../../../components/Pagination/Pagination.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import { formatDate, formatShortDate, formatWeekdayDate, isRealDate } from '../../../utils/calendar.js'
import { romeNow } from '../../../utils/kitchenStatus.js'
import styles from './AdminReservationsPage.module.css'

const PAGE_SIZE = 20
const SKELETON_ROWS = 8
const STATUSES = ['pending', 'confirmed', 'awaiting_verification', 'rejected', 'cancelled'] // filter order: what needs the admin first

// A wrong value typed in the URL is dropped here, so it never becomes a 400 from the server
const readFilters = (searchParams) => {
  const date = searchParams.get('date') ?? ''
  const status = searchParams.get('status') ?? ''
  return {
    date: isRealDate(date) ? date : '',
    status: STATUSES.includes(status) ? status : '',
    page: Math.max(1, parseInt(searchParams.get('page')) || 1),
  }
}

const toSearchParams = ({ date, status, page }) => { // empty values stay out of the URL: /admin/reservations?status=pending&page=2
  const params = {}
  if (date) params.date = date
  if (status) params.status = status
  if (page > 1) params.page = String(page)
  return params
}

const StatusBadge = ({ status }) => {
  const { t } = useLanguage()
  return <span className={`${styles.badge} ${styles[`badge_${status}`]}`}>{t(`adminReservations.status.${status}`)}</span>
}

const guestName = (reservation) => `${reservation.name} ${reservation.surname}`

const hasStarted = (reservation, now) => `${reservation.date} ${reservation.time}` <= `${now.date} ${now.time}` // same rule as the server

// What the admin can do with a row, as the server's transitions allow: a big group waits for Conferma/Rifiuta
// (only Rifiuta once its time has passed, so it doesn't wait forever), a confirmed booking can be cancelled until it starts
const actionsFor = (reservation, now) => {
  const started = hasStarted(reservation, now)
  if (reservation.status === 'pending') return started ? ['rejected'] : ['confirmed', 'rejected']
  if (reservation.status === 'confirmed' && !started) return ['cancelled']
  return []
}

// /admin/reservations: every booking, 20 per page. No date: from today (Rome) on, soonest first; a date: that day only, past days too.
// Date, status and page live in the URL (?date=&status=&page=), so back/forward and reload keep them
const AdminReservationsPage = () => {
  const { t, lang, tError } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const { date, status, page } = readFilters(searchParams)
  const [result, setResult] = useState(null) // { data, page, totalPages, total, key } of the list on screen, null until the first answer
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [pendingAction, setPendingAction] = useState(null) // { reservation, status } while the ConfirmDialog is open
  const [tableCheck, setTableCheck] = useState(null) // free tables for the booking being confirmed: { id, data } or { id, failed: true }
  const tableCheckRef = useRef(0) // only the answer for the dialog opened last is kept

  const now = romeNow()
  const today = now.date
  const currentYear = Number(today.slice(0, 4))
  const requestKey = `${date}|${status}|${page}`
  const hasFilters = Boolean(date || status)

  useEffect(() => {
    let ignore = false
    const params = { page, limit: PAGE_SIZE, date: date || undefined, status: status || undefined } // axios leaves undefined values out
    api.get('/reservations', { params })
      .then(({ data }) => {
        if (ignore) return
        if (data.data.length === 0 && page > 1) { // past the last page (old link): go to the last real one
          setSearchParams(toSearchParams({ date, status, page: Math.max(1, data.totalPages) }), { replace: true })
          return
        }
        setResult({ ...data, key: requestKey })
        setLoadError(null)
      })
      .catch((err) => {
        if (!ignore) setLoadError(err)
      })
    return () => {
      ignore = true
    }
  }, [date, status, page, requestKey, attempt, setSearchParams])

  const handleRetry = () => {
    setLoadError(null)
    setAttempt((current) => current + 1)
  }

  // The date field fires a change for every part typed with the keyboard (day, month, each digit of the year):
  // replace, so those steps don't fill the history. "Oggi" and the status filter add an entry, like the dishes' category filter
  const handleDateChange = (event) => {
    setSearchParams(toSearchParams({ date: event.target.value, status, page: 1 }), { replace: true })
  }

  const showToday = () => {
    if (date !== today) setSearchParams(toSearchParams({ date: today, status, page: 1 }))
  }

  const handleStatusChange = (event) => {
    setSearchParams(toSearchParams({ date, status: event.target.value, page: 1 }))
  }

  const clearFilters = () => setSearchParams({})

  const goToPage = (next) => {
    setSearchParams(toSearchParams({ date, status, page: next }))
    window.scrollTo(0, 0)
  }

  // Confirming a big group: the dialog opens at once and counts the free tables meanwhile. A warning, never a block: the admin decides
  const openAction = (reservation, status) => {
    setPendingAction({ reservation, status })
    setTableCheck(null)
    if (status !== 'confirmed') return

    const requestId = ++tableCheckRef.current
    api.get(`/reservations/${reservation._id}/free-tables`)
      .then(({ data }) => {
        if (requestId === tableCheckRef.current) setTableCheck({ id: reservation._id, data })
      })
      .catch(() => {
        if (requestId === tableCheckRef.current) setTableCheck({ id: reservation._id, failed: true })
      })
  }

  const closeAction = () => {
    tableCheckRef.current += 1 // a late answer for a closed dialog is ignored
    setPendingAction(null)
    setTableCheck(null)
  }

  const changeStatus = async () => {
    const { reservation, status } = pendingAction
    try {
      const { data } = await api.patch(`/reservations/${reservation._id}/status`, { status })
      const { emailSent, ...updated } = data
      setResult((current) => current && {
        ...current,
        data: current.data.map((row) => (row._id === updated._id ? updated : row)), // the row stays on screen with its new status, even under a status filter
      })

      const name = guestName(updated)
      if (emailSent) {
        toast.success(t(`adminReservations.actions.${status}.done`, { name }))
      } else { // the status is saved, only the email failed: the guest must hear it by phone
        toast.warning(t(`adminReservations.actions.${status}.emailFailed`), { description: `${name} · ${updated.phone}`, duration: 15000 })
      }
    } catch (err) {
      toast.error(tError(err))
      if (err.response?.status === 409 || err.response?.status === 404) setAttempt((current) => current + 1) // the row was out of date (the guest cancelled meanwhile): reload the list
    }
  }

  const dayLabel = (reservation) => (
    reservation.date === today ? t('adminReservations.today') : formatShortDate(reservation.date, lang, currentYear)
  )

  const guestsText = (reservation) => (
    reservation.partySize === 1 ? t('booking.guestCountOne') : t('booking.guestCount', { count: reservation.partySize })
  )

  const tablesText = (reservation) => (
    reservation.tablesNeeded === 1 ? t('adminReservations.tablesOne') : t('adminReservations.tables', { count: reservation.tablesNeeded })
  )

  const phoneLink = (reservation) => (
    <a href={`tel:${reservation.phone}`} className={styles.phone} aria-label={t('adminReservations.callLabel', { name: guestName(reservation) })}>
      {reservation.phone}
    </a>
  )

  const handledBy = (reservation) => reservation.handledBy?.name && (
    <span className={styles.handledBy}>{t('adminReservations.handledBy', { name: reservation.handledBy.name })}</span>
  )

  const rowActions = (reservation) => {
    const actions = actionsFor(reservation, now)
    if (actions.length === 0) return null
    return (
      <div className={styles.rowActions}>
        {actions.map((status) => (
          <button
            key={status}
            type="button"
            className={`${styles.actionButton} ${status === 'confirmed' ? styles.actionConfirm : styles.actionDecline}`}
            aria-label={t(`adminReservations.actions.${status}.buttonLabel`, { name: guestName(reservation) })}
            onClick={() => openAction(reservation, status)}
          >
            {t(`adminReservations.actions.${status}.button`)}
          </button>
        ))}
      </div>
    )
  }

  // Free tables in the confirm dialog: counting → "Tavoli liberi: 12 di 36 · ne servono 4" (+ warning when they're not enough) or "couldn't count"
  const freeTablesInfo = (reservation) => {
    const check = tableCheck?.id === reservation._id ? tableCheck : null
    let content
    if (!check) {
      content = <p className={styles.tableCheckMuted}>{t('adminReservations.freeTables.loading')}</p>
    } else if (check.failed) {
      content = <p className={styles.tableCheckWarning}>{t('adminReservations.freeTables.failed')}</p>
    } else {
      const { freeTables, maxOnlineTables, tablesNeeded } = check.data
      content = (
        <>
          <p className={styles.tableCheckCount}>
            {t(tablesNeeded === 1 ? 'adminReservations.freeTables.countOne' : 'adminReservations.freeTables.count', {
              free: freeTables,
              max: maxOnlineTables,
              needed: tablesNeeded,
            })}
          </p>
          {freeTables < tablesNeeded && <p className={styles.tableCheckWarning}>{t('adminReservations.freeTables.notEnough')}</p>}
        </>
      )
    }
    return <div className={styles.tableCheck} aria-live="polite">{content}</div>
  }

  let dialogProps = {}
  if (pendingAction) {
    const { reservation, status } = pendingAction
    const values = {
      name: guestName(reservation),
      count: reservation.partySize,
      guests: guestsText(reservation),
      day: formatWeekdayDate(reservation.date, lang),
      time: reservation.time,
    }
    dialogProps = {
      title: t(`adminReservations.actions.${status}.title`, values),
      message: t(`adminReservations.actions.${status}.message`, values),
      confirmLabel: t(`adminReservations.actions.${status}.confirmLabel`),
      cancelLabel: status === 'cancelled' ? t('adminReservations.actions.back') : undefined, // "Annulla" would mean both buttons
      destructive: status !== 'confirmed',
      children: status === 'confirmed' ? freeTablesInfo(reservation) : null,
    }
  }

  const isLoading = result && result.key !== requestKey // old rows stay on screen, dimmed, until the new list arrives

  let content
  if (!result && loadError) {
    content = (
      <div className={styles.loadError} role="alert">
        <p>{t('adminReservations.loadError')}</p>
        <div className={styles.emptyActions}>
          <button type="button" className={styles.retry} onClick={handleRetry}>{t('menu.retry')}</button>
          {hasFilters && (
            <button type="button" className={styles.clearButton} onClick={clearFilters}>{t('adminReservations.clearFilters')}</button>
          )}
        </div>
      </div>
    )
  } else if (!result) {
    content = (
      <LoadingState slowMessage="adminReservations.slow">
        <div className={styles.skeletons}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} height="5.5rem" radius="var(--radius-md)" />
          ))}
        </div>
      </LoadingState>
    )
  } else if (result.data.length === 0) {
    content = hasFilters ? (
      <div className={`${styles.empty} ${isLoading ? styles.loading : ''}`} role="status">
        <p className={styles.emptyTitle}>{t('adminReservations.noResults')}</p>
        <p>{t('adminReservations.noResultsHint')}</p>
        <button type="button" className={styles.clearButton} onClick={clearFilters}>{t('adminReservations.clearFilters')}</button>
      </div>
    ) : (
      <p className={`${styles.empty} ${isLoading ? styles.loading : ''}`} role="status">{t('adminReservations.empty')}</p>
    )
  } else {
    content = (
      <>
        {loadError && (
          <p className={styles.stale} role="alert">
            {tError(loadError)}
            <button type="button" className={styles.staleRetry} onClick={handleRetry}>{t('menu.retry')}</button>
          </p>
        )}

        <div className={isLoading ? styles.loading : ''} aria-busy={Boolean(isLoading)}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="visually-hidden">
                {t('adminReservations.tableLabel')} · {t('adminReservations.page', { page: result.page, total: result.totalPages })}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={styles.colWhen}>{t('adminReservations.columns.when')}</th>
                  <th scope="col" className={styles.colGuest}>{t('adminReservations.columns.guest')}</th>
                  <th scope="col" className={styles.colParty}>{t('adminReservations.columns.party')}</th>
                  <th scope="col" className={styles.colNotes}>{t('adminReservations.columns.notes')}</th>
                  <th scope="col" className={styles.colStatus}>{t('adminReservations.columns.status')}</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((reservation) => (
                  <tr key={reservation._id}>
                    <td>
                      <span className={styles.day}>{dayLabel(reservation)}</span>
                      <span className={styles.time}>{reservation.time}</span>
                    </td>
                    <th scope="row" className={styles.guest}>
                      <span className={styles.guestName}>{guestName(reservation)}</span>
                      <span className={styles.contact}>{phoneLink(reservation)}</span>
                      <span className={styles.contact}>{reservation.email}</span>
                    </th>
                    <td>
                      <span className={styles.party}>{guestsText(reservation)}</span>
                      <span className={styles.muted}>{tablesText(reservation)}</span>
                    </td>
                    <td className={styles.notes}>{reservation.notes || <span className={styles.muted} aria-hidden="true">—</span>}</td>
                    <td>
                      <StatusBadge status={reservation.status} />
                      {handledBy(reservation)}
                      {rowActions(reservation)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className={styles.cards} aria-label={t('adminReservations.tableLabel')}>
            {result.data.map((reservation) => (
              <li key={reservation._id} className={styles.card}>
                <div className={styles.cardTop}>
                  <p className={styles.cardWhen}>
                    <span className={styles.time}>{reservation.time}</span>
                    <span className={styles.day}>{dayLabel(reservation)}</span>
                  </p>
                  <StatusBadge status={reservation.status} />
                </div>
                <h2 className={styles.cardName}>{guestName(reservation)}</h2>
                <p className={styles.cardParty}>{guestsText(reservation)} · {tablesText(reservation)}</p>
                <p className={styles.cardContact}>
                  {phoneLink(reservation)}
                  <span className={styles.contact}>{reservation.email}</span>
                </p>
                {reservation.notes && <p className={styles.cardNotes}>{reservation.notes}</p>}
                {handledBy(reservation)}
                {rowActions(reservation)}
              </li>
            ))}
          </ul>
        </div>

        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          onPageChange={goToPage}
          label={t('adminReservations.paginationLabel')}
        />
      </>
    )
  }

  let countText = ''
  if (result && !isLoading) {
    const key = date ? 'count' : 'countUpcoming'
    countText = result.total === 1 ? t(`adminReservations.${key}One`) : t(`adminReservations.${key}`, { count: result.total })
    if (date) countText += ` · ${formatDate(date, lang)}`
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <p className={styles.kicker}>{t('adminReservations.kicker')}</p>
        <h1 className={styles.title}>{t('adminReservations.title')}</h1>
        <p className={styles.subtitle}>{t('adminReservations.subtitle')}</p>
      </header>

      <div className={styles.filters}>
        <div className={styles.field}>
          <label htmlFor="admin-reservation-date" className={styles.fieldLabel}>{t('adminReservations.dateLabel')}</label>
          <div className={styles.dateRow}>
            <input
              id="admin-reservation-date"
              type="date"
              className={styles.control}
              value={date}
              onChange={handleDateChange}
            />
            <button
              type="button"
              className={styles.todayButton}
              aria-label={t('adminReservations.todayLabel')}
              aria-pressed={date === today}
              onClick={showToday}
            >
              {t('adminReservations.today')}
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="admin-reservation-status" className={styles.fieldLabel}>{t('adminReservations.statusLabel')}</label>
          <select id="admin-reservation-status" className={styles.control} value={status} onChange={handleStatusChange}>
            <option value="">{t('adminReservations.allStatuses')}</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>{t(`adminReservations.statusFilter.${value}`)}</option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button type="button" className={styles.clearFilters} onClick={clearFilters}>{t('adminReservations.clearFilters')}</button>
        )}

        <p className={styles.count} aria-live="polite">{countText}</p>
      </div>

      {content}

      <ConfirmDialog open={Boolean(pendingAction)} onConfirm={changeStatus} onClose={closeAction} {...dialogProps} />
    </div>
  )
}

export default AdminReservationsPage
