import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import api, { getErrorCode } from '../../../api/client.js'
import ConfirmDialog from '../../../components/ConfirmDialog/ConfirmDialog.jsx'
import DishVisual from '../../../components/DishVisual/DishVisual.jsx'
import Icon from '../../../components/Icon/Icon.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Pagination from '../../../components/Pagination/Pagination.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import formatPrice from '../../../utils/formatPrice.js'
import thumbnailUrl from '../../../utils/thumbnailUrl.js'
import styles from './AdminDishesPage.module.css'

const LIST_PATH = '/admin/dishes'
const PAGE_SIZE = 20
const SKELETON_ROWS = 8
const SEARCH_DELAY = 300 // ms after the last key before the list reloads
const MAX_SEARCH_LENGTH = 50 // same limit as the server
const ROW_THUMBNAIL = 'c_fill,ar_4:3,f_auto,q_auto,w_160' // small photo in the table, same 4:3 crop as the menu
const CARD_THUMBNAIL = 'c_fill,ar_4:3,f_auto,q_auto,w_240'

const readFilters = (searchParams) => ({
  q: (searchParams.get('q') ?? '').trim(),
  category: searchParams.get('category') ?? '',
  page: Math.max(1, parseInt(searchParams.get('page')) || 1),
})

const toSearchParams = ({ q, category, page }) => { // empty values stay out of the URL: /admin/dishes?q=pollo&page=2
  const params = {}
  if (q) params.q = q
  if (category) params.category = category
  if (page > 1) params.page = String(page)
  return params
}

const DishPhoto = ({ dish, transform }) => (
  <span className={styles.photo}>
    {dish.image?.url ? (
      <img src={thumbnailUrl(dish.image.url, transform)} alt="" loading="lazy" width="64" height="48" />
    ) : (
      <DishVisual seed={dish.code} />
    )}
  </span>
)

const EnglishName = ({ dish }) => {
  const { t } = useLanguage()
  return dish.name.en?.trim()
    ? <span className={styles.nameEn} lang="en">{dish.name.en}</span>
    : <span className={styles.missing}>{t('adminDishes.missingEnglish')}</span>
}

const DishBadges = ({ dish }) => { // only what differs from a normal dish: sold out, hidden, chef's pick
  const { t } = useLanguage()
  if (dish.isAvailable && dish.isPublished && !dish.isFeatured) return null

  return (
    <span className={styles.badges}>
      {!dish.isAvailable && <span className={`${styles.badge} ${styles.badgeSoldOut}`}>{t('availability.soldOut')}</span>}
      {!dish.isPublished && <span className={styles.badge}>{t('adminDishes.unpublished')}</span>}
      {dish.isFeatured && <span className={`${styles.badge} ${styles.badgeFeatured}`}>{t('adminDishes.featured')}</span>}
    </span>
  )
}

const AvailabilityButton = ({ dish, onClick, className = '' }) => {
  const { t } = useLanguage()
  const values = { code: dish.code, name: dish.name.it }

  return (
    <button
      type="button"
      className={`${styles.toggle} ${dish.isAvailable ? '' : styles.toggleRestore} ${className}`}
      aria-label={t(dish.isAvailable ? 'availability.markSoldOutLabel' : 'availability.markAvailableLabel', values)}
      onClick={() => onClick(dish)}
    >
      {t(dish.isAvailable ? 'availability.markSoldOut' : 'availability.markAvailable')}
    </button>
  )
}

// Pencil in the table row: the same link as the name, visible as a control. It sits above the row's stretched link
const EditButton = ({ dish, state }) => {
  const { t } = useLanguage()
  const label = t('adminDishes.editLabel', { code: dish.code, name: dish.name.it })

  return (
    <Link to={`/admin/dishes/${dish._id}/edit`} state={state} className={styles.editButton} aria-label={label} title={label}>
      <Icon name="pencil" size={20} />
    </Link>
  )
}

// /admin/dishes: every dish (unpublished too), 20 per page, with search and category filter.
// Search, category and page live in the URL (?q=&category=&page=), so back/forward, reload and the edit form's "back" keep them
const AdminDishesPage = () => {
  const { t, pick, tError } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const { q, category, page } = readFilters(searchParams)
  const [searchText, setSearchText] = useState(q) // what is typed; reaches the URL (and the server) after SEARCH_DELAY
  const [syncedQ, setSyncedQ] = useState(q)
  const [result, setResult] = useState(null) // { data, page, totalPages, total, key } of the list on screen, null until the first answer
  const [categories, setCategories] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [dishToToggle, setDishToToggle] = useState(null)

  if (q !== syncedQ) { // the URL changed without typing (back/forward, "Cancella filtri"): the field follows it
    setSyncedQ(q)
    if (q !== searchText.trim()) setSearchText(q)
  }

  const requestKey = `${q}|${category}|${page}`
  const hasFilters = Boolean(q || category)

  useEffect(() => { // category names for the filter and the rows: the admin list sends only the category id
    let ignore = false
    api.get('/categories')
      .then(({ data }) => {
        if (!ignore) setCategories(data)
      })
      .catch(() => {}) // not blocking: the rows show "—" and the dishes still load
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => { // typing waits a moment, then changes the URL. replace: one history entry per search, not per key. A new search starts at page 1
    const text = searchText.trim()
    if (text === q) return
    const timer = setTimeout(() => {
      setSearchParams(toSearchParams({ q: text, category, page: 1 }), { replace: true })
    }, SEARCH_DELAY)
    return () => clearTimeout(timer)
  }, [searchText, q, category, setSearchParams])

  useEffect(() => {
    let ignore = false
    const params = { page, limit: PAGE_SIZE, q: q || undefined, category: category || undefined } // axios leaves undefined values out
    api.get('/admin/dishes', { params })
      .then(({ data }) => {
        if (ignore) return
        if (data.data.length === 0 && page > 1) { // past the last page (old link, or the last dish of this page was deleted): go to the last real one
          setSearchParams(toSearchParams({ q, category, page: Math.max(1, data.totalPages) }), { replace: true })
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
  }, [q, category, page, requestKey, attempt, setSearchParams])

  const categoryNames = useMemo(
    () => new Map(categories.map((item) => [item._id, pick(item.name)])),
    [categories, pick],
  )

  const reload = () => setAttempt((current) => current + 1)

  const handleRetry = () => {
    setLoadError(null)
    reload()
  }

  const handleSearchSubmit = (event) => { // Enter searches at once, without waiting for the delay
    event.preventDefault()
    const text = searchText.trim()
    if (text !== q) setSearchParams(toSearchParams({ q: text, category, page: 1 }), { replace: true })
  }

  const handleCategoryChange = (event) => {
    setSearchParams(toSearchParams({ q: searchText.trim(), category: event.target.value, page: 1 }))
  }

  const clearFilters = () => {
    setSearchText('')
    setSearchParams({})
  }

  const goToPage = (next) => {
    setSearchParams(toSearchParams({ q, category, page: next }))
    window.scrollTo(0, 0)
  }

  const toggleAvailability = async () => {
    const { _id, code, name, isAvailable } = dishToToggle
    const values = { code, name: name.it }
    try {
      const { data } = await api.patch(`/dishes/${_id}/availability`, { isAvailable: !isAvailable }) // explicit value, like the staff sheet
      setResult((current) => ({ ...current, data: current.data.map((dish) => (dish._id === data._id ? data : dish)) }))
      toast.success(t(data.isAvailable ? 'availability.doneAvailable' : 'availability.doneSoldOut', values))
    } catch (err) {
      toast.error(tError(err))
      if (getErrorCode(err) === 'DISH_NOT_FOUND') reload() // deleted meanwhile: the page is out of date
    }
  }

  const isLoading = result && result.key !== requestKey // old rows stay on screen, dimmed, until the new list arrives
  const listQuery = new URLSearchParams(toSearchParams({ q, category, page })).toString()
  const backState = { back: listQuery ? `${LIST_PATH}?${listQuery}` : LIST_PATH } // the form returns to this exact list after saving or deleting

  const editLink = (dish, className) => (
    <Link
      to={`/admin/dishes/${dish._id}/edit`}
      state={backState}
      className={className}
      aria-label={t('adminDishes.editLabel', { code: dish.code, name: dish.name.it })}
    >
      {dish.name.it}
    </Link>
  )

  let content
  if (!result && loadError) {
    content = (
      <div className={styles.loadError} role="alert">
        <p>{t('availability.loadError')}</p>
        <div className={styles.emptyActions}>
          <button type="button" className={styles.retry} onClick={handleRetry}>{t('menu.retry')}</button>
          {hasFilters && ( // a broken link (?category=wrong) can't be fixed by retrying
            <button type="button" className={styles.clearButton} onClick={clearFilters}>{t('adminDishes.clearFilters')}</button>
          )}
        </div>
      </div>
    )
  } else if (!result) {
    content = (
      <LoadingState slowMessage="availability.slow">
        <div className={styles.skeletons}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} height="4.5rem" radius="var(--radius-md)" />
          ))}
        </div>
      </LoadingState>
    )
  } else if (result.data.length === 0) {
    content = hasFilters ? (
      <div className={`${styles.empty} ${isLoading ? styles.loading : ''}`} role="status">
        <p className={styles.emptyTitle}>{t('adminDishes.noResults')}</p>
        <p>{t('adminDishes.noResultsHint')}</p>
        <button type="button" className={styles.clearButton} onClick={clearFilters}>{t('adminDishes.clearFilters')}</button>
      </div>
    ) : (
      <p className={styles.empty}>{t('adminDishes.empty')}</p>
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
                {t('adminDishes.tableLabel')} · {t('adminDishes.page', { page: result.page, total: result.totalPages })}
              </caption>
              <thead>
                <tr>
                  <th scope="col"><span className="visually-hidden">{t('adminDishes.columns.photo')}</span></th>
                  <th scope="col">{t('adminDishes.columns.code')}</th>
                  <th scope="col">{t('adminDishes.columns.name')}</th>
                  <th scope="col">{t('adminDishes.columns.category')}</th>
                  <th scope="col" className={styles.alignEnd}>{t('adminDishes.columns.price')}</th>
                  <th scope="col" className={styles.alignEnd}>{t('adminDishes.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((dish) => (
                  <tr key={dish._id} className={dish.isAvailable ? '' : styles.soldOut}>
                    <td className={styles.photoCell}><DishPhoto dish={dish} transform={ROW_THUMBNAIL} /></td>
                    <td><span className={styles.code}>{dish.code}</span></td>
                    <th scope="row" className={styles.name}>
                      {editLink(dish, styles.nameLink)}
                      <EnglishName dish={dish} />
                      <DishBadges dish={dish} />
                    </th>
                    <td className={styles.category}>{categoryNames.get(dish.category) || '—'}</td>
                    <td className={`${styles.price} ${styles.alignEnd}`}>{formatPrice(dish.price)}</td>
                    <td className={styles.alignEnd}>
                      <span className={styles.rowActions}>
                        <EditButton dish={dish} state={backState} />
                        <AvailabilityButton dish={dish} onClick={setDishToToggle} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className={styles.cards} aria-label={t('adminDishes.tableLabel')}>
            {result.data.map((dish) => (
              <li key={dish._id} className={`${styles.card} ${dish.isAvailable ? '' : styles.soldOut}`}>
                <DishPhoto dish={dish} transform={CARD_THUMBNAIL} />
                <div className={styles.cardBody}>
                  <p className={styles.cardMeta}>
                    <span className={styles.code}>{dish.code}</span>
                    <span className={styles.price}>{formatPrice(dish.price)}</span>
                  </p>
                  <h2 className={styles.cardName}>{editLink(dish, styles.cardLink)}</h2>
                  <EnglishName dish={dish} />
                  <p className={styles.category}>{categoryNames.get(dish.category) || '—'}</p>
                  <DishBadges dish={dish} />
                </div>
                <AvailabilityButton dish={dish} onClick={setDishToToggle} className={styles.cardToggle} />
              </li>
            ))}
          </ul>
        </div>

        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          onPageChange={goToPage}
          label={t('adminDishes.paginationLabel')}
        />
      </>
    )
  }

  let countText = ''
  if (result && !isLoading) {
    countText = result.total === 1 ? t('adminDishes.countOne') : t('adminDishes.count', { count: result.total })
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.kicker}>{t('adminDishes.kicker')}</p>
          <h1 className={styles.title}>{t('adminDishes.title')}</h1>
          <p className={styles.subtitle}>{t('adminDishes.subtitle')}</p>
        </div>
        <Link to="/admin/dishes/new" state={backState} className={styles.newDish}>{t('adminDishes.newDish')}</Link>
      </header>

      <form role="search" className={styles.filters} onSubmit={handleSearchSubmit}>
        <div className={styles.searchField}>
          <label htmlFor="admin-dish-search" className="visually-hidden">{t('adminDishes.searchLabel')}</label>
          <Icon name="search" size={20} className={styles.searchIcon} />
          <input
            id="admin-dish-search"
            type="search"
            className={styles.searchInput}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder={t('adminDishes.searchPlaceholder')}
            maxLength={MAX_SEARCH_LENGTH}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
        </div>

        <label htmlFor="admin-dish-category" className="visually-hidden">{t('adminDishes.categoryLabel')}</label>
        <select id="admin-dish-category" className={styles.categorySelect} value={category} onChange={handleCategoryChange}>
          <option value="">{t('adminDishes.allCategories')}</option>
          {categories.map((item) => (
            <option key={item._id} value={item._id}>{pick(item.name)}</option>
          ))}
        </select>

        <p className={styles.count} aria-live="polite">{countText}</p>
      </form>

      {content}

      <ConfirmDialog
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
    </div>
  )
}

export default AdminDishesPage
