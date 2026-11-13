import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import api, { getErrorCode } from '../../../api/client.js'
import ConfirmDialog from '../../../components/ConfirmDialog/ConfirmDialog.jsx'
import Icon from '../../../components/Icon/Icon.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import TicketSummary from '../../../components/TicketSummary/TicketSummary.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import formatPrice from '../../../utils/formatPrice.js'
import normalizeText from '../../../utils/normalizeText.js'
import { MAX_QTY, clearDraft, readDraft, saveDraft } from '../../../utils/ticketDraft.js'
import styles from './NewTicketPage.module.css'

const SKELETON_ROWS = 8
const ALL = 'all'
const STALE_DISH_CODES = ['DISH_UNAVAILABLE', 'INVALID_DISH'] // the dish list on screen is out of date: load it again

const matchesSearch = (dish, search) => // code from its start ("4" --> 4, 47, 4a), Italian name anywhere
  normalizeText(dish.code).startsWith(search) || normalizeText(dish.name.it).includes(search)

// Totals are summed in cents, like the server does. API prices are always whole cents (5.6 → 560),
// so the rounding only removes the float noise of * 100 (559.9999…): it never rounds a real price
const toCents = (euros) => Math.round(euros * 100)

// Each line needs its own React key: the same dish can be on several lines. No crypto.randomUUID(): it's missing on plain http (a phone on the LAN)
const newLineKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

// "+" on a dish row: one more on the dish's first line without notes, or a new line if it has none
const addToLines = (lines, dishId) => {
  const plain = lines.find((line) => line.dishId === dishId && !line.notes.trim())
  if (plain) return lines.map((line) => (line === plain ? { ...line, qty: Math.min(line.qty + 1, MAX_QTY) } : line))
  return [...lines, { key: newLineKey(), dishId, qty: 1, notes: '' }]
}

// The ticket editor for one table. Keyed by the table number below, so going to another table starts fresh with that table's draft
const TicketEditor = ({ number }) => {
  const tableNumber = Number(number)
  const navigate = useNavigate()
  const { t, pick, tError } = useLanguage()
  const [data, setData] = useState(null) // { dishes, categories, table }
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(ALL)
  const [lines, setLines] = useState(() => readDraft(tableNumber)) // [{ key, dishId, qty, notes }] in the order they were added
  const [view, setView] = useState('dishes') // phones only: dishes | ticket
  const [isConfirming, setIsConfirming] = useState(false)
  const ticketRef = useRef(null)

  useEffect(() => { // every change goes to the table's draft (an empty ticket removes it)
    saveDraft(tableNumber, lines)
  }, [tableNumber, lines])

  useEffect(() => {
    let ignore = false

    Promise.all([api.get('/dishes'), api.get('/categories'), api.get('/tables')])
      .then(([dishes, categories, tables]) => {
        if (ignore) return
        setData({
          dishes: dishes.data,
          categories: categories.data,
          table: tables.data.find((table) => table.number === tableNumber) ?? null, // null: not a table of this restaurant
        })
      })
      .catch((err) => {
        if (!ignore) setError(err)
      })

    return () => {
      ignore = true
    }
  }, [tableNumber, attempt])

  const dishById = useMemo(() => new Map((data?.dishes ?? []).map((dish) => [dish._id, dish])), [data])

  const search = normalizeText(query)
  const visibleDishes = useMemo(() => {
    if (!data) return []
    if (search) return data.dishes.filter((dish) => matchesSearch(dish, search)) // searching looks in every category
    if (category === ALL) return data.dishes
    return data.dishes.filter((dish) => dish.category === category)
  }, [data, search, category])

  const usedCategories = useMemo(() => { // only categories that have dishes, in menu order
    if (!data) return []
    const withDishes = new Set(data.dishes.map((dish) => dish.category))
    return data.categories.filter((item) => withDishes.has(item._id))
  }, [data])

  const ticketLines = lines.map((line) => ({ ...line, dish: dishById.get(line.dishId) })).filter((line) => line.dish)
  const dishTotal = ticketLines.reduce((sum, line) => sum + line.qty, 0)
  const total = ticketLines.reduce((sum, line) => sum + toCents(line.dish.price) * line.qty, 0) / 100
  const hasSoldOutLine = ticketLines.some((line) => !line.dish.isAvailable)
  const qtyOf = (dishId) => lines.reduce((sum, line) => (line.dishId === dishId ? sum + line.qty : sum), 0) // every line of the dish

  const addDish = (dish) => {
    setLines((current) => addToLines(current, dish._id))
  }

  const addVariant = (key) => { // same dish, new line right under this one: qty 1, notes still to write
    setLines((current) => {
      const index = current.findIndex((line) => line.key === key)
      if (index === -1) return current
      const variant = { key: newLineKey(), dishId: current[index].dishId, qty: 1, notes: '' }
      return [...current.slice(0, index + 1), variant, ...current.slice(index + 1)]
    })
  }

  const changeQty = (key, qty) => {
    setLines((current) => (qty < 1
      ? current.filter((line) => line.key !== key)
      : current.map((line) => (line.key === key ? { ...line, qty } : line))))
  }

  const changeNotes = (key, notes) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, notes } : line)))
  }

  const handleSearchSubmit = (event) => { // Enter in the search: "47" adds dish 47, or the only dish left in the results
    event.preventDefault()
    if (!search) return

    const dish = data.dishes.find((item) => normalizeText(item.code) === search)
      ?? (visibleDishes.length === 1 ? visibleDishes[0] : null)

    if (!dish) {
      toast.error(t(visibleDishes.length ? 'newTicket.pickOne' : 'newTicket.noDish', { query: query.trim() }), { id: 'quick-add' })
      return
    }
    if (!dish.isAvailable) {
      toast.error(t('newTicket.dishSoldOut', { code: dish.code, name: dish.name.it }), { id: 'quick-add' })
      return
    }

    addDish(dish)
    setQuery('') // focus stays in the field: ready for the next number
    toast.success(t('newTicket.added', { code: dish.code, name: dish.name.it }), { id: 'quick-add' })
  }

  const reloadDishes = async () => { // after a 409: grey out what was sold out in the meantime
    try {
      const { data: dishes } = await api.get('/dishes')
      setData((current) => ({ ...current, dishes }))
    } catch {
      // the error toast is already showing
    }
  }

  const sendTicket = async () => {
    try {
      const { data: order } = await api.post('/orders', {
        tableNumber,
        items: ticketLines.map(({ dishId, qty, notes }) => ({ dish: dishId, qty, notes: notes.trim() })),
      })
      clearDraft(tableNumber) // sent: the next ticket for this table starts empty
      toast.success(t('newTicket.sent', { number: tableNumber, round: t('tables.round', { round: order.round }) }))
      navigate('/staff/waiter', { replace: true }) // back doesn't reopen a ticket already sent
    } catch (err) {
      toast.error(tError(err))
      if (STALE_DISH_CODES.includes(getErrorCode(err))) await reloadDishes()
    }
  }

  // Bottom bar → "Comanda" tab (phones), then to the first sold-out line, or to the ticket's title when nothing is sold out.
  // flushSync renders the tab first, so the line is on screen before we scroll to it
  const showTicket = () => {
    flushSync(() => setView('ticket'))

    const section = ticketRef.current
    const soldOutLine = section.querySelector('[data-sold-out]')
    const target = soldOutLine ?? section
    target.scrollIntoView({ block: soldOutLine ? 'center' : 'start' }) // smooth only when motion is allowed (scroll-behavior in global.css)

    const focusTarget = soldOutLine?.querySelector('button') ?? section.querySelector('h2') // the line's "−": one tap and it's gone
    focusTarget.focus({ preventScroll: true })
  }

  const handleRetry = () => {
    setError(null)
    setAttempt((current) => current + 1)
  }

  const backLink = (
    <Link to="/staff/waiter" className={styles.back}>
      {t('newTicket.back')}
    </Link>
  )

  if (error) {
    return (
      <div className={styles.page}>
        {backLink}
        <div className={styles.message} role="alert">
          <p>{tError(error)}</p>
          <button type="button" className={styles.primary} onClick={handleRetry}>{t('menu.retry')}</button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className={styles.page}>
        {backLink}
        <LoadingState slowMessage="newTicket.slow">
          <div className={styles.skeleton}>
            <Skeleton width="60%" height="2rem" />
            <Skeleton height="3rem" radius="var(--radius-md)" />
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <Skeleton key={index} height="4rem" radius="var(--radius-lg)" />
            ))}
          </div>
        </LoadingState>
      </div>
    )
  }

  if (!data.table) {
    return (
      <div className={styles.page}>
        {backLink}
        <div className={styles.message} role="alert">
          <p>{t('newTicket.invalidTable', { number })}</p>
        </div>
      </div>
    )
  }

  const round = t('tables.round', { round: data.table.openTickets + 1 }) // the server counts it the same way when it saves
  const dishesLabel = dishTotal === 1 ? t('tables.dishesOne') : t('tables.dishes', { count: dishTotal })

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {backLink}
        <p className={styles.kicker}>{t('newTicket.kicker')}</p>
        <h1 className={styles.title}>
          {t('tables.tableNumber', { number: tableNumber })} · {round}
        </h1>
      </header>

      <div className={styles.tabs} role="group" aria-label={t('newTicket.viewLabel')}>
        {['dishes', 'ticket'].map((value) => (
          <button
            key={value}
            type="button"
            className={`${styles.tab} ${view === value ? styles.tabActive : ''}`}
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {value === 'dishes' ? t('newTicket.tabDishes') : t('newTicket.tabTicket', { count: dishTotal })}
          </button>
        ))}
      </div>

      <div className={styles.layout}>
        <section className={`${styles.picker} ${view !== 'dishes' ? styles.hiddenOnPhone : ''}`} aria-labelledby="picker-title">
          <h2 id="picker-title" className="visually-hidden">{t('newTicket.tabDishes')}</h2>

          <form className={styles.search} role="search" onSubmit={handleSearchSubmit}>
            <label htmlFor="dish-search" className="visually-hidden">{t('newTicket.searchLabel')}</label>
            <input
              id="dish-search"
              type="search"
              className={styles.searchInput}
              value={query}
              placeholder={t('newTicket.searchPlaceholder')}
              autoComplete="off"
              enterKeyHint="done"
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" className={styles.searchAdd} disabled={!search}>{t('newTicket.add')}</button>
          </form>

          <div className={`${styles.chips} hide-scrollbar`} role="group" aria-label={t('newTicket.categoryLabel')}>
            {[{ _id: ALL, label: t('newTicket.allCategories') }, ...usedCategories].map((item) => (
              <button
                key={item._id}
                type="button"
                className={`${styles.chip} ${!search && category === item._id ? styles.chipActive : ''}`}
                aria-pressed={!search && category === item._id}
                onClick={() => {
                  setCategory(item._id)
                  setQuery('')
                }}
              >
                {item.label ?? pick(item.name)}
              </button>
            ))}
          </div>

          {visibleDishes.length > 0 ? (
            <ul className={styles.dishes}>
              {visibleDishes.map((dish) => {
                const qty = qtyOf(dish._id)
                const isSoldOut = !dish.isAvailable
                const label = `${dish.code} ${dish.name.it}`

                return (
                  <li key={dish._id} className={`${styles.dish} ${isSoldOut ? styles.dishSoldOut : ''} ${qty ? styles.dishPicked : ''}`}>
                    <span className={styles.code}>{dish.code}</span>
                    <span className={styles.dishText}>
                      <span className={styles.dishName}>{dish.name.it}</span>
                      <span className={styles.dishPrice}>
                        {isSoldOut ? t('dish.soldOut') : formatPrice(dish.price)}
                      </span>
                    </span>

                    <span className={styles.rowActions}>
                      {qty > 0 && (
                        <span className={styles.picked}>
                          <span aria-hidden="true">×{qty}</span>
                          <span className="visually-hidden">{t('newTicket.onTicket', { count: qty })}</span>
                        </span>
                      )}
                      <button
                        type="button"
                        className={styles.add}
                        disabled={isSoldOut}
                        aria-label={isSoldOut ? t('newTicket.soldOutLabel', { name: label }) : t('newTicket.addDish', { name: label })}
                        onClick={() => addDish(dish)}
                      >
                        <Icon name="plus" size={22} />
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className={styles.empty}>{t('newTicket.noResults', { query: query.trim() })}</p>
          )}
        </section>

        <section
          ref={ticketRef}
          id="ticket-panel"
          className={`${styles.ticket} ${view !== 'ticket' ? styles.hiddenOnPhone : ''}`}
          aria-labelledby="ticket-title"
        >
          <h2 id="ticket-title" className={styles.ticketTitle} tabIndex={-1}>{t('newTicket.ticketTitle')}</h2>
          <TicketSummary
            lines={ticketLines}
            onQtyChange={changeQty}
            onNotesChange={changeNotes}
            onAddVariant={addVariant}
          />
        </section>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerText}>
          <button type="button" className={styles.footerTotals} aria-controls="ticket-panel" onClick={showTicket}>
            <span>{dishesLabel}</span>
            <strong>{formatPrice(total)}</strong>
            <span className="visually-hidden">{t('newTicket.showTicket')}</span>
          </button>
          {hasSoldOutLine && (
            <button type="button" className={styles.footerWarning} aria-controls="ticket-panel" onClick={showTicket}>
              {t('newTicket.removeSoldOut')}
            </button>
          )}
        </div>
        <button
          type="button"
          className={styles.primary}
          disabled={ticketLines.length === 0 || hasSoldOutLine}
          onClick={() => setIsConfirming(true)}
        >
          {t('newTicket.send')}
        </button>
      </div>

      <ConfirmDialog
        open={isConfirming}
        title={t('newTicket.confirmTitle', { round, number: tableNumber })}
        message={`${dishesLabel} · ${formatPrice(total)}`}
        confirmLabel={t('newTicket.send')}
        onConfirm={sendTicket}
        onClose={() => setIsConfirming(false)}
      />
    </div>
  )
}

// /staff/waiter/tables/:number/new: pick dishes, set qty and notes, send one ticket to the kitchen
const NewTicketPage = () => {
  const { number } = useParams()
  return <TicketEditor key={number} number={number} /> // a new key = a new editor: state and draft never leak between tables
}

export default NewTicketPage
