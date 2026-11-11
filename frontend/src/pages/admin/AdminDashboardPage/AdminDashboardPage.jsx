import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import api from '../../../api/client.js'
import ConfirmDialog from '../../../components/ConfirmDialog/ConfirmDialog.jsx'
import Icon from '../../../components/Icon/Icon.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import TableTile from '../../../components/TableTile/TableTile.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import usePolling from '../../../hooks/usePolling.js'
import dishCount from '../../../utils/dishCount.js'
import formatPrice from '../../../utils/formatPrice.js'
import formatTime from '../../../utils/formatTime.js'
import { romeNow } from '../../../utils/kitchenStatus.js'
import styles from './AdminDashboardPage.module.css'

const POLL_MS = 5000 // room and tickets, same rhythm as the waiter screen
const DISHES_POLL_MS = 30000 // sold-out and translations change rarely: no need to reload the whole menu every 5s
const BOOKINGS_POLL_MS = 60000 // bookings change rarely during service
const SKELETON_BOOKINGS = 3
const UPCOMING_BOOKINGS = 5 // rows in "Prossime prenotazioni"
const LEGEND = ['free', 'occupied', 'preparing', 'ready']
const PREVIEW_NAMES = 3 // dish names shown in a "Richiede attenzione" row
const SKELETON_TILES = 24
const STAT_CARDS = 4

const StatCard = ({ icon, tone, label, value, detail }) => (
  <article className={styles.stat}>
    <span className={`${styles.statIcon} ${styles[tone]}`}><Icon name={icon} size={20} /></span>
    <h2 className={styles.statLabel}>{label}</h2>
    <p className={styles.statValue}>{value}</p>
    <p className={styles.statDetail}>{detail}</p>
  </article>
)

// "Richiede attenzione" row: count + first dish names, links to the dish list
const AttentionRow = ({ icon, tone, title, dishes }) => {
  const { pick } = useLanguage()
  const names = dishes.slice(0, PREVIEW_NAMES).map((dish) => `${dish.code} ${pick(dish.name)}`).join(', ')
  const more = dishes.length > PREVIEW_NAMES ? '…' : ''

  return (
    <li>
      <Link to="/admin/dishes" className={styles.attentionRow}>
        <span className={`${styles.attentionIcon} ${styles[tone]}`}><Icon name={icon} size={18} /></span>
        <span className={styles.attentionText}>
          <strong>{title}</strong>
          <span>{names}{more}</span>
        </span>
        <Icon name="chevron" size={18} />
      </Link>
    </li>
  )
}

// /admin: service overview. Room and tickets refresh every 5s, the menu checks every 30s
const AdminDashboardPage = () => {
  const { t, tError } = useLanguage()
  const [tables, setTables] = useState(null) // null until the first answer
  const [orders, setOrders] = useState([]) // every open ticket
  const [error, setError] = useState(null)
  const [dishes, setDishes] = useState(null) // published menu, for "Richiede attenzione"
  const [dishesError, setDishesError] = useState(false)
  const [ticketToServe, setTicketToServe] = useState(null)
  const [bookings, setBookings] = useState(null) // { today, todayTotal, pendingGroups }: null until the first answer
  const [bookingsError, setBookingsError] = useState(false)
  const latestLoad = useRef(0)

  const load = useCallback(async () => {
    const loadId = ++latestLoad.current // an older poll that answers late never overwrites newer data (es: right after "Segna servita")
    try {
      const [tablesRes, ordersRes] = await Promise.all([
        api.get('/tables'),
        api.get('/orders'), // open tickets only, oldest first
      ])
      if (loadId !== latestLoad.current) return
      setTables(tablesRes.data)
      setOrders(ordersRes.data)
      setError(null)
    } catch (err) {
      if (loadId === latestLoad.current) setError(err) // a 401 is handled by the axios interceptor (back to login)
    }
  }, [])

  const loadDishes = useCallback(async () => {
    try {
      const { data } = await api.get('/dishes') // what guests see: a sold-out or untranslated dish here is a real problem
      setDishes(data)
      setDishesError(false)
    } catch {
      setDishesError(true) // keep the last list, the panel shows a short note
    }
  }, [])

  const loadBookings = useCallback(async () => {
    try {
      const [todayRes, pendingRes] = await Promise.all([
        api.get('/reservations', { params: { date: romeNow().date, status: 'confirmed', limit: 100 } }), // today in Rome, soonest first
        api.get('/reservations', { params: { status: 'pending', limit: 1 } }), // only the count: big groups from today on, waiting for an answer
      ])
      setBookings({ today: todayRes.data.data, todayTotal: todayRes.data.total, pendingGroups: pendingRes.data.total })
      setBookingsError(false)
    } catch {
      setBookingsError(true) // keep the last numbers on screen
    }
  }, [])

  usePolling(load, POLL_MS)
  usePolling(loadDishes, DISHES_POLL_MS)
  usePolling(loadBookings, BOOKINGS_POLL_MS)

  const retryBookings = () => {
    setBookingsError(false)
    loadBookings()
  }

  const handleRetry = () => {
    setError(null)
    load()
  }

  const markServed = async () => {
    const { _id, tableNumber, round } = ticketToServe
    try {
      await api.patch(`/orders/${_id}/status`, { status: 'served' })
      toast.success(t('waiter.servedToast', { number: tableNumber, round: t('tables.round', { round }) }))
    } catch (err) { // 409: a waiter served it first, the reload below shows the current state
      toast.error(tError(err))
    }
    await load()
  }

  const title = (
    <div className={styles.hero}>
      <p className={styles.kicker}>{t('adminDashboard.kicker')}</p>
      <h1 className={styles.title}>{t('adminDashboard.title')}</h1>
      <p className={styles.subtitle}>{t('adminDashboard.subtitle')}</p>
    </div>
  )

  if (!tables && error) {
    return (
      <div className={styles.page}>
        {title}
        <div className={styles.loadError} role="alert">
          <p>{t('waiter.loadError')}</p>
          <button type="button" className={styles.retry} onClick={handleRetry}>{t('menu.retry')}</button>
        </div>
      </div>
    )
  }

  if (!tables) {
    return (
      <div className={styles.page}>
        {title}
        <LoadingState slowMessage="waiter.slow">
          <div className={styles.loading}>
            <div className={styles.stats}>
              {Array.from({ length: STAT_CARDS }, (_, index) => (
                <Skeleton key={index} height="8.5rem" radius="var(--radius-lg)" />
              ))}
            </div>
            <div className={styles.roomGrid}>
              {Array.from({ length: SKELETON_TILES }, (_, index) => (
                <Skeleton key={index} height="4.75rem" radius="var(--radius-md)" />
              ))}
            </div>
          </div>
        </LoadingState>
      </div>
    )
  }

  const occupied = tables.filter((table) => table.status !== 'free')
  const openTickets = occupied.reduce((sum, table) => sum + table.openTickets, 0)
  const inKitchen = orders.filter((ticket) => ticket.status === 'sent' || ticket.status === 'preparing').length
  const readyTickets = orders.filter((ticket) => ticket.status === 'ready')
  const openTotal = occupied.reduce((sum, table) => sum + table.total, 0) // euros from the API; formatPrice rounds the display

  const soldOut = dishes?.filter((dish) => !dish.isAvailable) ?? []
  const missingEnglish = dishes?.filter((dish) => !dish.name.en?.trim()) ?? []

  const now = romeNow() // the page re-renders every 5 s (room polling), so a booking leaves the panel once its time comes
  const upcomingBookings = bookings?.today
    .filter((booking) => booking.time > now.time) // "HH:mm" strings compare in time order; the list is already soonest first
    .slice(0, UPCOMING_BOOKINGS) ?? [] // the whole day is behind "Gestisci"
  let bookingsDetail = '' // "36 coperti previsti", empty while loading
  if (bookings) {
    const expectedGuests = bookings.today.reduce((sum, booking) => sum + booking.partySize, 0)
    bookingsDetail = expectedGuests === 1
      ? t('adminDashboard.stats.bookingsDetailOne')
      : t('adminDashboard.stats.bookingsDetail', { count: expectedGuests })
  } else if (bookingsError) {
    bookingsDetail = t('adminDashboard.stats.bookingsUnknown')
  }

  return (
    <div className={styles.page}>
      {title}

      {error && <p className={styles.stale} role="status">{t('waiter.stale')}</p>}

      <section className={styles.stats} aria-label={t('adminDashboard.statsLabel')}>
        <StatCard
          icon="table"
          tone="wine"
          label={t('adminDashboard.stats.tables')}
          value={`${occupied.length} / ${tables.length}`}
          detail={t('adminDashboard.stats.tablesDetail', { count: tables.length - occupied.length })}
        />
        <StatCard
          icon="chef"
          tone="amber"
          label={t('adminDashboard.stats.tickets')}
          value={openTickets}
          detail={t('adminDashboard.stats.ticketsDetail', { count: inKitchen })}
        />
        <StatCard
          icon="calendar"
          tone="green"
          label={t('adminDashboard.stats.bookings')}
          value={bookings ? bookings.todayTotal : '–'}
          detail={bookingsDetail}
        />
        <StatCard
          icon="list"
          tone="blue"
          label={t('adminDashboard.stats.total')}
          value={formatPrice(openTotal)}
          detail={occupied.length === 1
            ? t('adminDashboard.stats.totalDetailOne')
            : t('adminDashboard.stats.totalDetail', { count: occupied.length })}
        />
      </section>

      <div className={styles.grid}>
        <section className={styles.panel} aria-labelledby="room-title">
          <div className={styles.panelHeader}>
            <div>
              <h2 id="room-title" className={styles.panelTitle}>{t('adminDashboard.room.title')}</h2>
              <p className={styles.panelSubtitle}>{t('adminDashboard.room.subtitle')}</p>
            </div>
          </div>

          <ul className={styles.roomGrid}>
            {tables.map((table) => (
              <li key={table.number}>
                <TableTile table={table} compact />
              </li>
            ))}
          </ul>

          <ul className={styles.legend} aria-label={t('adminDashboard.room.legendLabel')}>
            {LEGEND.map((status) => (
              <li key={status} className={styles.legendItem}>
                <span className={`${styles.swatch} ${styles[`swatch_${status}`]}`} aria-hidden="true" />
                {t(`tables.status.${status}`)}
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.side}>
          <section className={styles.panel} aria-labelledby="ready-title">
            <div className={styles.panelHeader}>
              <div>
                <h2 id="ready-title" className={styles.panelTitle}>{t('waiter.readyTitle')}</h2>
                <p className={styles.panelSubtitle}>{t('adminDashboard.ready.subtitle')}</p>
              </div>
              {readyTickets.length > 0 && <span className={styles.readyCount}>{readyTickets.length}</span>}
            </div>

            {readyTickets.length > 0 ? (
              <ul className={styles.rows}>
                {readyTickets.map((ticket) => {
                  const count = dishCount(ticket)
                  return (
                    <li key={ticket._id} className={styles.readyRow}>
                      <span className={`${styles.rowIcon} ${styles.wine}`}><Icon name="dish" size={18} /></span>
                      <span className={styles.rowText}>
                        <strong>{t('tables.tableNumber', { number: ticket.tableNumber })}</strong>
                        <span>
                          {t('tables.round', { round: ticket.round })}
                          {' · '}
                          {count === 1 ? t('tables.dishesOne') : t('tables.dishes', { count })}
                          {' · '}
                          {t('readyBell.readyAt', { time: formatTime(ticket.updatedAt) })}
                        </span>
                      </span>
                      <button type="button" className={styles.serve} onClick={() => setTicketToServe(ticket)}>
                        <Icon name="check" size={18} />
                        {t('waiter.markServed')}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className={styles.allGood}>
                <Icon name="check" size={20} />
                {t('readyBell.none')}
              </p>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="bookings-title">
            <div className={styles.panelHeader}>
              <div>
                <h2 id="bookings-title" className={styles.panelTitle}>{t('adminDashboard.bookings.title')}</h2>
                <p className={styles.panelSubtitle}>{t('adminDashboard.bookings.subtitle')}</p>
              </div>
              <Link to={`/admin/reservations?date=${now.date}`} className={styles.panelLink}>{t('adminDashboard.bookings.manage')}</Link>
            </div>

            {bookings?.pendingGroups > 0 && (
              <ul className={`${styles.rows} ${styles.pendingList}`}>
                <li>
                  <Link to="/admin/reservations?status=pending" className={styles.attentionRow}>
                    <span className={`${styles.attentionIcon} ${styles.amber}`}><Icon name="people" size={18} /></span>
                    <span className={styles.attentionText}>
                      <strong>{t('adminDashboard.bookings.pendingGroups', { count: bookings.pendingGroups })}</strong>
                      <span>{t('adminDashboard.bookings.pendingHint')}</span>
                    </span>
                    <Icon name="chevron" size={18} />
                  </Link>
                </li>
              </ul>
            )}

            {bookingsError && bookings && <p className={styles.panelStale} role="status">{t('adminDashboard.bookings.stale')}</p>}

            {!bookings && bookingsError && (
              <div className={styles.panelError} role="alert">
                <p>{t('adminDashboard.bookings.loadError')}</p>
                <button type="button" className={styles.retry} onClick={retryBookings}>{t('menu.retry')}</button>
              </div>
            )}

            {!bookings && !bookingsError && (
              <div className={`${styles.rows} ${styles.bookingsPending}`}> {/* keeps its size during the skeleton's 200 ms delay */}
                <LoadingState quiet>
                  <ul className={styles.bookingSkeletons}>
                    {Array.from({ length: SKELETON_BOOKINGS }, (_, index) => (
                      <li key={index} className={styles.bookingRow}>
                        <Skeleton width="2.75rem" height="1.1rem" />
                        <Skeleton width="70%" height="1rem" />
                        <Skeleton width="5rem" height="0.9rem" />
                      </li>
                    ))}
                  </ul>
                </LoadingState>
              </div>
            )}

            {upcomingBookings.length > 0 && (
              <ul className={styles.rows}>
                {upcomingBookings.map((booking) => (
                  <li key={booking._id} className={styles.bookingRow}>
                    <strong className={styles.bookingTime}>{booking.time}</strong>
                    <span className={styles.bookingName}>{booking.name} {booking.surname}</span>
                    <span className={styles.bookingParty}>
                      {booking.partySize === 1 ? t('booking.guestCountOne') : t('booking.guestCount', { count: booking.partySize })}
                      {' · '}
                      {booking.tablesNeeded === 1 ? t('adminReservations.tablesOne') : t('adminReservations.tables', { count: booking.tablesNeeded })}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {bookings && upcomingBookings.length === 0 && (
              <p className={styles.allGood}>
                <Icon name="calendar" size={20} />
                {bookings.today.length === 0 ? t('todayBookings.empty') : t('adminDashboard.bookings.noneLeft')}
              </p>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="attention-title">
            <div className={styles.panelHeader}>
              <div>
                <h2 id="attention-title" className={styles.panelTitle}>{t('adminDashboard.attention.title')}</h2>
                <p className={styles.panelSubtitle}>{t('adminDashboard.attention.subtitle')}</p>
              </div>
            </div>

            {!dishes && dishesError && <p className={styles.allGood}>{t('adminDashboard.attention.loadError')}</p>}
            {!dishes && !dishesError && (
              <div className={`${styles.rows} ${styles.attentionPending}`}> {/* keeps its size during the skeleton's 200 ms delay */}
                <LoadingState slowMessage="availability.slow">
                  <Skeleton height="3.5rem" radius="var(--radius-md)" />
                </LoadingState>
              </div>
            )}

            {dishes && (soldOut.length > 0 || missingEnglish.length > 0) && (
              <ul className={styles.rows}>
                {soldOut.length > 0 && (
                  <AttentionRow
                    icon="alert"
                    tone="amber"
                    title={soldOut.length === 1
                      ? t('adminDashboard.attention.soldOutOne')
                      : t('adminDashboard.attention.soldOut', { count: soldOut.length })}
                    dishes={soldOut}
                  />
                )}
                {missingEnglish.length > 0 && (
                  <AttentionRow
                    icon="globe"
                    tone="wine"
                    title={missingEnglish.length === 1
                      ? t('adminDashboard.attention.missingEnglishOne')
                      : t('adminDashboard.attention.missingEnglish', { count: missingEnglish.length })}
                    dishes={missingEnglish}
                  />
                )}
              </ul>
            )}

            {dishes && soldOut.length === 0 && missingEnglish.length === 0 && (
              <p className={styles.allGood}>
                <Icon name="check" size={20} />
                {t('adminDashboard.attention.none')}
              </p>
            )}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(ticketToServe)}
        title={ticketToServe && t('waiter.serveTitle', {
          round: t('tables.round', { round: ticketToServe.round }),
          number: ticketToServe.tableNumber,
        })}
        message={ticketToServe && t('waiter.serveMessage', {
          dishes: dishCount(ticketToServe) === 1 ? t('tables.dishesOne') : t('tables.dishes', { count: dishCount(ticketToServe) }),
        })}
        confirmLabel={t('waiter.markServed')}
        onConfirm={markServed}
        onClose={() => setTicketToServe(null)}
      />
    </div>
  )
}

export default AdminDashboardPage
