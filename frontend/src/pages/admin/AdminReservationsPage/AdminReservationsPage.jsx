import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import api from '../../../api/client.js'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Pagination from '../../../components/Pagination/Pagination.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import { formatDate, formatShortDate, isRealDate } from '../../../utils/calendar.js'
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

// /admin/reservations: every booking, 20 per page. No date: from today (Rome) on, soonest first; a date: that day only, past days too.
// Date, status and page live in the URL (?date=&status=&page=), so back/forward and reload keep them
const AdminReservationsPage = () => {
  const { t, lang, tError } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const { date, status, page } = readFilters(searchParams)
  const [result, setResult] = useState(null) // { data, page, totalPages, total, key } of the list on screen, null until the first answer
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  const today = romeNow().date
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
    </div>
  )
}

export default AdminReservationsPage
