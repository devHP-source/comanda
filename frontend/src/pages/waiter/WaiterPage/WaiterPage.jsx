import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import api from '../../../api/client.js'
import AvailabilitySheet from '../../../components/AvailabilitySheet/AvailabilitySheet.jsx'
import ConfirmDialog from '../../../components/ConfirmDialog/ConfirmDialog.jsx'
import Icon from '../../../components/Icon/Icon.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import ReadyTicketCard from '../../../components/ReadyTicketCard/ReadyTicketCard.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import TableSheet from '../../../components/TableSheet/TableSheet.jsx'
import TableTile from '../../../components/TableTile/TableTile.jsx'
import TodayBookings from '../../../components/TodayBookings/TodayBookings.jsx'
import useAuth from '../../../hooks/useAuth.js'
import useLanguage from '../../../hooks/useLanguage.js'
import usePolling from '../../../hooks/usePolling.js'
import dishCount from '../../../utils/dishCount.js'
import formatPrice from '../../../utils/formatPrice.js'
import { romeNow } from '../../../utils/restaurantClock.js'
import styles from './WaiterPage.module.css'

const POLL_MS = 5000
const FILTERS = ['all', 'occupied', 'ready']
const SKELETON_TILES = 12

const matchesFilter = (table, filter) => {
  if (filter === 'occupied') return table.status !== 'free'
  if (filter === 'ready') return table.status === 'ready'
  return true
}

const timeOfDay = () => { // Greeting and service from the restaurant's clock: "Buongiorno" until 14:00, lunch service until 17:00
  const { time } = romeNow()
  return {
    time,
    greeting: time < '14:00' ? 'morning' : 'evening',
    service: time < '17:00' ? 'lunch' : 'dinner',
  }
}

const WaiterPage = () => { // /staff/waiter: "Pronto da servire" strip + room grid, both refreshed every 5s
  const { t, tError } = useLanguage()
  const { user } = useAuth()
  const [tables, setTables] = useState(null) // null until the first answer
  const [orders, setOrders] = useState([]) // every open ticket: the ready strip and the table sheet both read from it
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [ticketToServe, setTicketToServe] = useState(null)
  const [selectedNumber, setSelectedNumber] = useState(null)
  const [tableToClose, setTableToClose] = useState(null)
  const [sheetNotice, setSheetNotice] = useState(null) // { type: 'success' | 'error', text }: shown inside the table sheet, a toast would sit under its backdrop
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false)
  const latestLoad = useRef(0)

  const load = useCallback(async () => {
    const loadId = ++latestLoad.current // an older poll that answers late never overwrites newer data (e.g. right after "Segna servita")
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

  usePolling(load, POLL_MS)

  const handleRetry = () => {
    setError(null)
    load()
  }

  const openSheet = (number) => {
    setSheetNotice(null)
    setSelectedNumber(number)
  }

  const closeSheet = () => {
    setSheetNotice(null)
    setSelectedNumber(null)
  }

  const markServed = async () => {
    const { _id, tableNumber, round } = ticketToServe
    const fromSheet = selectedNumber !== null // the strip can't be tapped while the sheet is open
    try {
      await api.patch(`/orders/${_id}/status`, { status: 'served' })
      const text = t('waiter.servedToast', { number: tableNumber, round: t('tables.round', { round }) })
      if (fromSheet) setSheetNotice({ type: 'success', text })
      else toast.success(text)
    } catch (err) { // 409: another waiter served it first, the reload below shows the current state
      if (fromSheet) setSheetNotice({ type: 'error', text: tError(err) })
      else toast.error(tError(err))
    }
    await load()
  }

  const closeTable = async () => {
    const { number } = tableToClose
    try {
      const { data } = await api.post(`/tables/${number}/close`)
      closeSheet() // the table is free: back to the room, where the toast is visible
      toast.success(t('waiter.closedToast', { number, total: formatPrice(data.total) }))
    } catch (err) { // "Libera tavolo" lives only in the sheet, which is still open. 409 TABLE_ALREADY_FREE: someone else closed it, the reload shows it
      setSheetNotice({ type: 'error', text: tError(err) })
    }
    await load()
  }

  const readyTickets = orders.filter((ticket) => ticket.status === 'ready')
  const selectedTable = tables?.find((table) => table.number === selectedNumber)
  const closeNotServed = tableToClose
    ? orders.filter((ticket) => ticket.tableNumber === tableToClose.number && ticket.status !== 'served').length
    : 0

  const { time, greeting, service } = timeOfDay()
  const firstName = user.name.split(' ')[0]

  let content
  if (!tables && error) {
    content = (
      <div className={styles.loadError} role="alert">
        <p>{t('waiter.loadError')}</p>
        <button type="button" className={styles.retry} onClick={handleRetry}>{t('menu.retry')}</button>
      </div>
    )
  } else if (!tables) {
    content = (
      <LoadingState slowMessage="waiter.slow">
        <div className={styles.layout}>
          <Skeleton height="11rem" radius="var(--radius-card)" />
          <div className={styles.grid}>
            {Array.from({ length: SKELETON_TILES }, (_, index) => (
              <Skeleton key={index} height="6rem" radius="var(--radius-lg)" />
            ))}
          </div>
        </div>
      </LoadingState>
    )
  } else {
    const visibleTables = tables.filter((table) => matchesFilter(table, filter))
    const occupiedCount = tables.filter((table) => table.status !== 'free').length

    content = (
      <div className={styles.layout}>
        <section className={styles.readySection} aria-labelledby="ready-title">
          <div className={styles.heading}>
            <div>
              <p className={styles.kicker}>{t('waiter.readyKicker')}</p>
              <h2 id="ready-title" className={styles.title}>{t('waiter.readyTitle')}</h2>
            </div>
            {readyTickets.length > 0 && <span className={styles.readyCount}>{readyTickets.length}</span>}
          </div>

          {readyTickets.length > 0 ? (
            <ul className={`${styles.readyList} hide-scrollbar`}>
              {readyTickets.map((ticket) => (
                <li key={ticket._id} className={styles.readyItem}>
                  <ReadyTicketCard ticket={ticket} onServe={setTicketToServe} />
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.allServed}>
              <Icon name="check" size={20} />
              {t('waiter.allServed')}
            </p>
          )}
        </section>

        <div className={styles.main}> {/* right column from tablet up: the room, then today's bookings */}
          <section aria-labelledby="tables-title">
            <div className={styles.heading}>
              <div>
                <p className={`${styles.kicker} ${styles.muted}`}>{t('waiter.roomKicker')}</p>
                <h2 id="tables-title" className={styles.title}>{t('waiter.tablesTitle')}</h2>
              </div>
              <span className={styles.occupied}>
                {occupiedCount === 1 ? t('waiter.occupiedOne') : t('waiter.occupied', { count: occupiedCount })}
              </span>
            </div>

            <div className={styles.filters} role="group" aria-label={t('waiter.filterLabel')}>
              {FILTERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.filter} ${filter === value ? styles.filterActive : ''}`}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {t(`waiter.filters.${value}`)}
                </button>
              ))}
            </div>

            {error && <p className={styles.stale} role="status">{t('waiter.stale')}</p>}

            {visibleTables.length > 0 ? (
              <ul className={styles.grid}>
                {visibleTables.map((table) => (
                  <li key={table.number}>
                    <TableTile table={table} onSelect={openSheet} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>{t(`waiter.empty.${filter}`)}</p>
            )}
          </section>

          <TodayBookings />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>{t(`waiter.greeting.${greeting}`, { name: firstName })}</h1>
          <p className={styles.service}>{t(`waiter.service.${service}`)} · {time}</p>
        </div>
        <button type="button" className={styles.availability} onClick={() => setIsAvailabilityOpen(true)}>
          <Icon name="dish" size={20} />
          {t('availability.open')}
        </button>
      </header>

      {content}

      {selectedTable && (
        <TableSheet
          table={selectedTable}
          tickets={orders.filter((ticket) => ticket.tableNumber === selectedTable.number)}
          notice={sheetNotice}
          onClose={closeSheet}
          onServe={(ticket) => {
            setSheetNotice(null) // an old message would read as the answer to this tap
            setTicketToServe(ticket)
          }}
          onCloseTable={(table) => {
            setSheetNotice(null)
            setTableToClose(table)
          }}
        />
      )}

      {isAvailabilityOpen && <AvailabilitySheet onClose={() => setIsAvailabilityOpen(false)} />}

      <ConfirmDialog
        open={Boolean(tableToClose)}
        destructive
        title={tableToClose && t('waiter.closeTitle', { number: tableToClose.number })}
        message={tableToClose && [
          t('waiter.closeMessage', {
            total: formatPrice(tableToClose.total),
            tickets: tableToClose.openTickets === 1 ? t('waiter.closeTicketsOne') : t('waiter.closeTickets', { count: tableToClose.openTickets }),
          }),
          closeNotServed > 0 && (closeNotServed === 1 ? t('waiter.closeWarningOne') : t('waiter.closeWarning', { count: closeNotServed })),
        ].filter(Boolean).join(' ')}
        confirmLabel={t('tableSheet.closeTable')}
        onConfirm={closeTable}
        onClose={() => setTableToClose(null)}
      />

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

export default WaiterPage
