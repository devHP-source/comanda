import { useCallback, useEffect, useRef, useState } from 'react'
import { toast, Toaster } from 'sonner'
import api, { getToken } from '../../../api/client.js'
import AvailabilitySheet from '../../../components/AvailabilitySheet/AvailabilitySheet.jsx'
import ConfirmDialog from '../../../components/ConfirmDialog/ConfirmDialog.jsx'
import Icon from '../../../components/Icon/Icon.jsx'
import KitchenTicket from '../../../components/KitchenTicket/KitchenTicket.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import usePolling from '../../../hooks/usePolling.js'
import { formatWeekdayDate } from '../../../utils/calendar.js'
import { romeNow } from '../../../utils/restaurantClock.js'
import toastStyle from '../../../utils/toastStyle.js'
import styles from './KitchenPage.module.css'

const POLL_MS = 5000
const UNDO_MS = 5000 // the PATCH leaves only when the "Annulla" toast closes
const COLUMNS = ['sent', 'preparing', 'ready']
const SKELETON_TICKETS = 2
const TOASTER_ID = 'kitchen' // undo toasts go to the board's own Toaster, the app's one keeps its look

const kitchenToastOptions = {
  style: { ...toastStyle, fontSize: 'var(--text-md)' }, // read at a glance, from a step away
  actionButtonStyle: { // sonner's action button is 24px high: too small for a cook's hands
    minHeight: 'var(--tap-min)',
    padding: '0 var(--space-4)',
    borderRadius: 'var(--radius-pill)',
    color: 'var(--color-white)',
    background: 'var(--color-accent)',
    fontSize: 'var(--text-sm)',
    fontWeight: 800,
  },
}

const KitchenPage = () => { // /staff/kitchen: tickets in 3 columns, refreshed every 5s. A tap moves the card at once, the server hears about it 5s later
  const { t, tError, lang } = useLanguage()
  const [orders, setOrders] = useState(null) // null until the first answer
  const [error, setError] = useState(null)
  const [polledAt, setPolledAt] = useState(() => Date.now()) // "12 min" waiting times move on with each poll
  const [pending, setPending] = useState({}) // orderId --> action moved on screen but not sent yet, drawn on top of the server's status
  const [activeColumn, setActiveColumn] = useState('sent') // phones: one column at a time
  const [ticketToReopen, setTicketToReopen] = useState(null) // ready ticket the cook wants back in preparing (confirm first)
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false)
  const pendingRef = useRef(new Map()) // the same actions for the toast callbacks: whoever takes an action out of here (undo or send) wins
  const latestLoad = useRef(0)
  const nextKey = useRef(0)
  const tErrorRef = useRef(tError)

  useEffect(() => {
    tErrorRef.current = tError // the latest language for error toasts, without changing sendAction (that would flush the pending actions)
  }, [tError])

  const load = useCallback(async () => {
    const loadId = ++latestLoad.current // an older poll that answers late never overwrites newer data
    try {
      const { data } = await api.get('/orders', { params: { status: 'sent,preparing,ready' } }) // open tickets, oldest first
      if (loadId !== latestLoad.current) return
      setOrders(data)
      setError(null)
    } catch (err) {
      if (loadId === latestLoad.current) setError(err) // a 401 is handled by the axios interceptor (back to login)
    }
    setPolledAt(Date.now()) // even when the server is down: the clock still runs
  }, [])

  usePolling(load, POLL_MS)

  const dropPending = useCallback((action) => { // the card goes back to the server's status
    setPending((current) => {
      if (current[action.orderId]?.key !== action.key) return current // a newer tap on the same card replaced it
      const rest = { ...current }
      delete rest[action.orderId]
      return rest
    })
  }, [])

  const sendAction = useCallback(async (action) => {
    if (pendingRef.current.get(action.orderId) !== action) return // undone, or already sent (toast closed + unmount)
    pendingRef.current.delete(action.orderId)

    try {
      const { data } = await api.patch(
        `/orders/${action.orderId}/status`,
        { status: action.status },
        { headers: { Authorization: `Bearer ${action.token}` } }, // the token of the tap: still valid after logout or "Torna admin"
      )
      latestLoad.current++ // a poll that started before the PATCH would bring the old status back
      setOrders((current) => current?.map((order) => (order._id === data._id ? data : order)))
    } catch (err) {
      toast.error(tErrorRef.current(err)) // e.g. 409 when the ticket changed meanwhile. The card moves back below
      load()
    }
    dropPending(action)
  }, [load, dropPending])

  const undo = (action) => {
    if (pendingRef.current.get(action.orderId) !== action) return // too late: already sent
    pendingRef.current.delete(action.orderId)
    dropPending(action)
  }

  const advance = (ticket, status) => {
    const previous = pendingRef.current.get(ticket._id)
    if (previous) { // second tap on the same card within 5s (sent --> preparing --> ready): send the first step now, in order
      sendAction(previous)
      toast.dismiss(previous.toastId)
    }

    const key = ++nextKey.current
    const action = { key, orderId: ticket._id, status, token: getToken(), toastId: `kitchen-${key}` }
    pendingRef.current.set(ticket._id, action)
    setPending((current) => ({ ...current, [ticket._id]: action }))

    toast(t(`kitchen.toast.${status}`, {
      number: ticket.tableNumber,
      round: t('tables.round', { round: ticket.round }),
    }), {
      id: action.toastId,
      toasterId: TOASTER_ID,
      duration: UNDO_MS,
      action: { label: t('kitchen.undo'), onClick: () => undo(action) },
      onAutoClose: () => sendAction(action), // 5s passed
      onDismiss: () => sendAction(action), // swiped away: not an undo
    })
  }

  useEffect(() => { // Leaving the board (other page, logout) sends what's still waiting, at once
    const pendingActions = pendingRef.current
    return () => {
      for (const action of [...pendingActions.values()]) {
        sendAction(action)
        toast.dismiss(action.toastId)
      }
    }
  }, [sendAction])

  const reopen = async () => { // Fix a wrong "Pronto" after its undo is gone: confirmed in the dialog, so sent at once (no undo toast)
    const { _id, tableNumber, round } = ticketToReopen
    try {
      const { data } = await api.patch(`/orders/${_id}/status`, { status: 'preparing' })
      latestLoad.current++ // a poll already on its way would show it ready again
      setOrders((current) => current?.map((order) => (order._id === data._id ? data : order)))
      toast.success(t('kitchen.reopened', { number: tableNumber, round: t('tables.round', { round }) }), { toasterId: TOASTER_ID })
    } catch (err) {
      toast.error(tError(err), { toasterId: TOASTER_ID }) // 409: a waiter served it meanwhile, the reload shows it
      load()
    }
  }

  const handleRetry = () => {
    setError(null)
    load()
  }

  const { date, time } = romeNow()
  const service = time < '17:00' ? 'lunch' : 'dinner'
  const today = formatWeekdayDate(date, lang)

  const columnOf = (order) => pending[order._id]?.status ?? order.status // a pending tap wins over polling
  const byColumn = Object.fromEntries(COLUMNS.map((status) => [status, (orders ?? []).filter((order) => columnOf(order) === status)]))

  let content
  if (!orders && error) {
    content = (
      <div className={styles.loadError} role="alert">
        <p>{t('kitchen.loadError')}</p>
        <button type="button" className={styles.retry} onClick={handleRetry}>{t('menu.retry')}</button>
      </div>
    )
  } else if (!orders) {
    content = (
      <LoadingState slowMessage="kitchen.slow">
        <div className={styles.board}>
          {COLUMNS.map((status) => (
            <div key={status} className={`${styles.column} ${styles.loadingColumn} ${status === activeColumn ? styles.active : ''}`}>
              <div className={styles.list}>
                {Array.from({ length: SKELETON_TICKETS }, (_, index) => (
                  <Skeleton key={index} height="15rem" radius="var(--radius-lg)" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </LoadingState>
    )
  } else {
    content = (
      <>
        <div className={styles.tabs} role="group" aria-label={t('kitchen.columnsLabel')}>
          {COLUMNS.map((status) => (
            <button
              key={status}
              type="button"
              className={`${styles.tab} ${activeColumn === status ? styles.tabActive : ''}`}
              aria-pressed={activeColumn === status}
              onClick={() => setActiveColumn(status)}
            >
              <span>{t(`kitchen.summary.${status}`)}</span> {/* short labels: three fit on a 320px phone */}
              <span className={styles.tabCount}>{byColumn[status].length}</span> {/* shown above the label (column-reverse), read after it */}
            </button>
          ))}
        </div>

        {error && <p className={styles.stale} role="status">{t('kitchen.stale')}</p>}

        <div className={styles.board}>
          {COLUMNS.map((status) => (
            <section
              key={status}
              className={`${styles.column} ${styles[status]} ${status === activeColumn ? styles.active : ''}`}
              aria-labelledby={`column-${status}`}
            >
              <header className={styles.columnHeader}>
                <div>
                  <h2 id={`column-${status}`} className={styles.columnTitle}>{t(`kitchen.columns.${status}.title`)}</h2>
                  <p className={styles.columnSubtitle}>{t(`kitchen.columns.${status}.subtitle`)}</p>
                </div>
                <span className={styles.count}>{byColumn[status].length}</span>
              </header>

              {byColumn[status].length > 0 ? (
                <ul className={styles.list}>
                  {byColumn[status].map((order) => (
                    <li key={order._id}>
                      <KitchenTicket
                        ticket={{ ...order, status: columnOf(order) }}
                        now={polledAt}
                        isPending={Boolean(pending[order._id])}
                        onAdvance={advance}
                        onReopen={setTicketToReopen}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.empty}>
                  <Icon name="check" size={26} />
                  {t('kitchen.empty')}
                </p>
              )}
            </section>
          ))}
        </div>
      </>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('kitchen.title')}</h1>
          <p className={styles.service}>{t(`waiter.service.${service}`)} · {today} · {time}</p>
        </div>

        <div className={styles.headerSide}>
          {orders && (
            <dl className={styles.summary}>
              {COLUMNS.map((status) => (
                <div key={status} className={status === 'ready' ? styles.summaryReady : ''}>
                  <dt>{t(`kitchen.summary.${status}`)}</dt>
                  <dd>{byColumn[status].length}</dd>
                </div>
              ))}
            </dl>
          )}
          <button type="button" className={styles.availability} onClick={() => setIsAvailabilityOpen(true)}>
            <Icon name="dish" size={20} />
            {t('availability.open')}
          </button>
        </div>
      </header>

      {content}

      {isAvailabilityOpen && <AvailabilitySheet onClose={() => setIsAvailabilityOpen(false)} />}

      <ConfirmDialog
        open={Boolean(ticketToReopen)}
        title={ticketToReopen && t('kitchen.reopenTitle', {
          number: ticketToReopen.tableNumber,
          round: t('tables.round', { round: ticketToReopen.round }),
        })}
        message={t('kitchen.reopenMessage')}
        confirmLabel={t('kitchen.reopenConfirm')}
        onConfirm={reopen}
        onClose={() => setTicketToReopen(null)}
      />

      <Toaster // bottom: near the cook's hand. expand + visibleToasts: every pending "Annulla" stays visible, no collapsed stack
        id={TOASTER_ID}
        position="bottom-center"
        expand
        visibleToasts={20}
        toastOptions={kitchenToastOptions}
      />
    </div>
  )
}

export default KitchenPage
