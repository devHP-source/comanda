import { useEffect, useId, useMemo, useRef, useState } from 'react'
import api, { getErrorCode } from '../../api/client.js'
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog.jsx'
import Icon from '../Icon/Icon.jsx'
import LoadingState from '../LoadingState/LoadingState.jsx'
import Skeleton from '../Skeleton/Skeleton.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import normalizeText from '../../utils/normalizeText.js'
import styles from './AvailabilitySheet.module.css'

const FILTERS = ['all', 'soldOut']
const SKELETON_ROWS = 6

const matchesSearch = (dish, search) => // code from its start ("4" --> 4, 47, 4a), Italian or English name anywhere
  normalizeText(dish.code).startsWith(search)
  || normalizeText(dish.name.it).includes(search)
  || normalizeText(dish.name.en).includes(search)

// Kitchen and waiter: find a dish and mark it "Esaurito" (or available again). Mounted by the parent to open it, like TableSheet.
const AvailabilitySheet = ({ onClose }) => {
  const { t, tError } = useLanguage()
  const [dishes, setDishes] = useState(null) // null until the first answer
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [dishToToggle, setDishToToggle] = useState(null)
  const [notice, setNotice] = useState(null) // { type: 'success' | 'error', text }: shown inside the sheet, a toast would sit under the modal's backdrop
  const dialogRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
  }, [])

  useEffect(() => { // fresh list every time the sheet opens: another colleague may have changed it
    let ignore = false
    api.get('/dishes') // published dishes, sorted by code
      .then(({ data }) => {
        if (!ignore) setDishes(data)
      })
      .catch((err) => {
        if (!ignore) setLoadError(err)
      })
    return () => {
      ignore = true
    }
  }, [attempt])

  const search = normalizeText(query)
  const soldOutCount = dishes?.filter((dish) => !dish.isAvailable).length ?? 0
  const visibleDishes = useMemo(() => (dishes ?? [])
    .filter((dish) => filter === 'all' || !dish.isAvailable)
    .filter((dish) => !search || matchesSearch(dish, search)), [dishes, filter, search])

  const handleRetry = () => {
    setLoadError(null)
    setAttempt((current) => current + 1)
  }

  const handleBackdropClick = (event) => { // the content fills the dialog, so a click on the dialog itself is on the backdrop
    if (event.target === dialogRef.current) dialogRef.current.close()
  }

  const toggleAvailability = async () => {
    const { _id, code, name, isAvailable } = dishToToggle
    const values = { code, name: name.it }
    try {
      const { data } = await api.patch(`/dishes/${_id}/availability`, { isAvailable: !isAvailable }) // explicit value: two taps at once can't flip it back
      setDishes((current) => current.map((dish) => (dish._id === data._id ? data : dish)))
      setNotice({ type: 'success', text: t(data.isAvailable ? 'availability.doneAvailable' : 'availability.doneSoldOut', values) })
    } catch (err) {
      setNotice({ type: 'error', text: tError(err) })
      if (getErrorCode(err) === 'DISH_NOT_FOUND') setAttempt((current) => current + 1) // deleted meanwhile: the list is out of date
    }
  }

  let content
  if (!dishes && loadError) {
    content = (
      <div className={styles.loadError} role="alert">
        <p>{t('availability.loadError')}</p>
        <button type="button" className={styles.retry} onClick={handleRetry}>{t('menu.retry')}</button>
      </div>
    )
  } else if (!dishes) {
    content = (
      <LoadingState slowMessage="availability.slow">
        <div className={styles.list}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} height="4.25rem" radius="var(--radius-lg)" />
          ))}
        </div>
      </LoadingState>
    )
  } else if (visibleDishes.length === 0) {
    content = (
      <p className={styles.empty}>
        {search ? t('availability.noResults', { query: query.trim() }) : t('availability.noneSoldOut')}
      </p>
    )
  } else {
    content = (
      <ul className={styles.list}>
        {visibleDishes.map((dish) => (
          <li key={dish._id} className={`${styles.row} ${dish.isAvailable ? '' : styles.rowSoldOut}`}>
            <span className={styles.code}>{dish.code}</span>
            <span className={styles.name}>
              {dish.name.it}
              {!dish.isAvailable && <span className={styles.badge}>{t('availability.soldOut')}</span>}
            </span>
            <button
              type="button"
              className={`${styles.toggle} ${dish.isAvailable ? '' : styles.toggleRestore}`}
              aria-label={t(dish.isAvailable ? 'availability.markSoldOutLabel' : 'availability.markAvailableLabel', { code: dish.code, name: dish.name.it })}
              onClick={() => {
                setNotice(null)
                setDishToToggle(dish)
              }}
            >
              {t(dish.isAvailable ? 'availability.markSoldOut' : 'availability.markAvailable')}
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={titleId}
        onClose={onClose} // Esc, Android back, backdrop, close button
        onClick={handleBackdropClick}
      >
        <div className={styles.top}>
          <header className={styles.header}>
            <div>
              <p className={styles.kicker}>{t('availability.kicker')}</p>
              <h2 id={titleId} className={styles.title}>{t('availability.title')}</h2>
            </div>
            <button
              type="button"
              className={styles.close}
              aria-label={t('availability.close')}
              onClick={() => dialogRef.current.close()}
            >
              <Icon name="close" size={22} />
            </button>
          </header>

          <label className={styles.search}>
            <Icon name="search" size={20} />
            <span className="visually-hidden">{t('availability.searchLabel')}</span>
            <input
              type="search"
              className={styles.searchInput}
              value={query}
              placeholder={t('availability.searchPlaceholder')}
              autoComplete="off"
              enterKeyHint="search"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className={styles.filters} role="group" aria-label={t('availability.filterLabel')}>
            {FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                className={`${styles.filter} ${filter === value ? styles.filterActive : ''}`}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {t(`availability.filters.${value}`)}
                {value === 'soldOut' && dishes && <span className={styles.filterCount}>{soldOutCount}</span>}
              </button>
            ))}
          </div>

          <p className={notice?.type === 'error' ? styles.noticeError : styles.notice} role="status">
            {notice?.text}
          </p>
        </div>

        <div className={styles.scroll}>{content}</div>
      </dialog>

      <ConfirmDialog // outside the sheet's <dialog>: it opens on top of it (top layer), and its close event never reaches the sheet
        open={Boolean(dishToToggle)}
        title={dishToToggle && t(dishToToggle.isAvailable ? 'availability.soldOutTitle' : 'availability.availableTitle', {
          code: dishToToggle.code,
          name: dishToToggle.name.it,
        })}
        message={dishToToggle && t(dishToToggle.isAvailable ? 'availability.soldOutMessage' : 'availability.availableMessage')}
        confirmLabel={dishToToggle && t(dishToToggle.isAvailable ? 'availability.markSoldOut' : 'availability.markAvailable')}
        onConfirm={toggleAvailability}
        onClose={() => setDishToToggle(null)}
      />
    </>
  )
}

export default AvailabilitySheet
