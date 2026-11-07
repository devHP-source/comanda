import { useCallback, useEffect, useId, useRef, useState } from 'react'
import api from '../../api/client.js'
import Icon from '../Icon/Icon.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import usePolling from '../../hooks/usePolling.js'
import dishCount from '../../utils/dishCount.js'
import formatTime from '../../utils/formatTime.js'
import styles from './ReadyBell.module.css'

const POLL_MS = 5000

// "Pronto" badge in every staff header (waiter, kitchen, admin): count of ready tickets, tap → the list.
// Read only: "Segna servita" stays on the waiter screen (and the admin dashboard), behind its confirm modal
const ReadyBell = () => {
  const { t } = useLanguage()
  const [tickets, setTickets] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const wrapRef = useRef(null)
  const buttonRef = useRef(null)
  const latestLoad = useRef(0)
  const panelId = useId()

  const load = useCallback(async () => {
    const loadId = ++latestLoad.current // an older poll that answers late never overwrites newer data
    try {
      const { data } = await api.get('/orders', { params: { status: 'ready' } }) // open tickets only, oldest first
      if (loadId === latestLoad.current) setTickets(data)
    } catch {
      // keep the last list: a failed poll every 5s must not spam toasts (a 401 is handled by the axios interceptor)
    }
  }, [])

  usePolling(load, POLL_MS)

  useEffect(() => { // Open list: Esc or a tap outside closes it
    if (!isOpen) return undefined

    const handleKey = (event) => {
      if (event.key !== 'Escape') return
      setIsOpen(false)
      buttonRef.current?.focus()
    }
    const handlePointer = (event) => {
      if (!wrapRef.current?.contains(event.target)) setIsOpen(false)
    }

    document.addEventListener('keydown', handleKey)
    document.addEventListener('pointerdown', handlePointer)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('pointerdown', handlePointer)
    }
  }, [isOpen])

  const count = tickets.length
  let label = t('readyBell.none')
  if (count === 1) label = t('readyBell.countOne')
  else if (count > 1) label = t('readyBell.count', { count })

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.bell} ${count > 0 ? styles.hasReady : ''}`}
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Icon name="bell" size={20} />
        {count > 0 && <span className={styles.badge} aria-hidden="true">{count}</span>}
      </button>

      <span className="visually-hidden" aria-live="polite">{count > 0 ? label : ''}</span> {/* screen readers hear a new "Pronto" too */}

      <div id={panelId} className={styles.panel} hidden={!isOpen}>
        <p className={styles.title}>{t('readyBell.title')}</p>

        {count > 0 ? (
          <ul className={styles.list}>
            {tickets.map((ticket) => {
              const dishes = dishCount(ticket)
              return (
                <li key={ticket._id} className={styles.item}>
                  <span className={styles.icon}><Icon name="dish" size={18} /></span>
                  <span className={styles.text}>
                    <span className={styles.table}>{t('tables.tableNumber', { number: ticket.tableNumber })}</span>
                    <span className={styles.detail}>
                      {t('tables.round', { round: ticket.round })}
                      {' · '}
                      {dishes === 1 ? t('tables.dishesOne') : t('tables.dishes', { count: dishes })}
                    </span>
                  </span>
                  <span className={styles.time}>{t('readyBell.readyAt', { time: formatTime(ticket.updatedAt) })}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className={styles.empty}>
            <Icon name="check" size={18} />
            {t('readyBell.none')}
          </p>
        )}
      </div>
    </div>
  )
}

export default ReadyBell
