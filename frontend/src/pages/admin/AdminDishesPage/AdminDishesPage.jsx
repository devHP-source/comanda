import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import api, { getErrorCode } from '../../../api/client.js'
import ConfirmDialog from '../../../components/ConfirmDialog/ConfirmDialog.jsx'
import DishVisual from '../../../components/DishVisual/DishVisual.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import formatPrice from '../../../utils/formatPrice.js'
import thumbnailUrl from '../../../utils/thumbnailUrl.js'
import styles from './AdminDishesPage.module.css'

const PAGE_SIZE = 20
const SKELETON_ROWS = 8
const ROW_THUMBNAIL = 'c_fill,ar_4:3,f_auto,q_auto,w_160' // small photo in the table, same 4:3 crop as the menu

const pageFromParams = (searchParams) => Math.max(1, parseInt(searchParams.get('page')) || 1)

// /admin/dishes: every dish (unpublished too), 20 per page. The page lives in the URL (?page=2), so back/forward and reload keep it
const AdminDishesPage = () => {
  const { t, pick, tError } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = pageFromParams(searchParams)
  const [result, setResult] = useState(null) // { data, page, totalPages } of the page on screen, null until the first answer
  const [categories, setCategories] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [dishToToggle, setDishToToggle] = useState(null)
  const [dishToDelete, setDishToDelete] = useState(null)

  useEffect(() => { // category names for the table: the admin list sends only the category id
    let ignore = false
    api.get('/categories')
      .then(({ data }) => {
        if (!ignore) setCategories(data)
      })
      .catch(() => {}) // not blocking: the column shows "—" and the dishes still load
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false
    api.get('/admin/dishes', { params: { page, limit: PAGE_SIZE } })
      .then(({ data }) => {
        if (ignore) return
        if (data.data.length === 0 && page > 1) { // past the last page (old link, or the last dish of this page was deleted): go to the last real one
          const lastPage = Math.max(1, data.totalPages)
          setSearchParams(lastPage === 1 ? {} : { page: String(lastPage) }, { replace: true })
          return
        }
        setResult(data)
        setLoadError(null)
      })
      .catch((err) => {
        if (!ignore) setLoadError(err)
      })
    return () => {
      ignore = true
    }
  }, [page, attempt, setSearchParams])

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category._id, pick(category.name)])),
    [categories, pick],
  )

  const reload = () => setAttempt((current) => current + 1)

  const handleRetry = () => {
    setLoadError(null)
    reload()
  }

  const goToPage = (next) => {
    setSearchParams(next === 1 ? {} : { page: String(next) })
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

  const deleteDish = async () => {
    const { _id, code, name } = dishToDelete
    try {
      await api.delete(`/dishes/${_id}`)
      toast.success(t('adminDishes.deleted', { code, name: name.it }))
    } catch (err) {
      toast.error(tError(err)) // 404: already deleted, the reload shows it
    }
    reload() // the next dishes move up into this page
  }

  const isPageLoading = result && result.page !== page // old rows stay on screen until the new page arrives

  let content
  if (!result && loadError) {
    content = (
      <div className={styles.loadError} role="alert">
        <p>{t('availability.loadError')}</p>
        <button type="button" className={styles.retry} onClick={handleRetry}>{t('menu.retry')}</button>
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
    content = <p className={styles.empty}>{t('adminDishes.empty')}</p>
  } else {
    content = (
      <>
        {loadError && (
          <p className={styles.stale} role="alert">
            {tError(loadError)}
            <button type="button" className={styles.staleRetry} onClick={handleRetry}>{t('menu.retry')}</button>
          </p>
        )}

        <div className={styles.tableWrap} role="region" aria-labelledby="dishes-caption" tabIndex={0}>
          <table className={`${styles.table} ${isPageLoading ? styles.tableLoading : ''}`} aria-busy={Boolean(isPageLoading)}>
            <caption id="dishes-caption" className="visually-hidden">
              {t('adminDishes.tableLabel')} · {t('adminDishes.page', { page: result.page, total: result.totalPages })}
            </caption>
            <thead>
              <tr>
                <th scope="col"><span className="visually-hidden">{t('adminDishes.columns.photo')}</span></th>
                <th scope="col">{t('adminDishes.columns.code')}</th>
                <th scope="col">{t('adminDishes.columns.name')}</th>
                <th scope="col">{t('adminDishes.columns.category')}</th>
                <th scope="col" className={styles.alignEnd}>{t('adminDishes.columns.price')}</th>
                <th scope="col">{t('adminDishes.columns.status')}</th>
                <th scope="col" className={styles.alignEnd}>{t('adminDishes.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((dish) => (
                <tr key={dish._id} className={dish.isAvailable ? '' : styles.rowSoldOut}>
                  <td>
                    <span className={styles.photo}>
                      {dish.image?.url ? (
                        <img src={thumbnailUrl(dish.image.url, ROW_THUMBNAIL)} alt="" loading="lazy" width="64" height="48" />
                      ) : (
                        <DishVisual seed={dish.code} />
                      )}
                    </span>
                  </td>
                  <td><span className={styles.code}>{dish.code}</span></td>
                  <th scope="row" className={styles.name}>
                    <span className={styles.nameIt}>{dish.name.it}</span>
                    {dish.name.en?.trim() ? (
                      <span className={styles.nameEn} lang="en">{dish.name.en}</span>
                    ) : (
                      <span className={styles.missing}>{t('adminDishes.missingEnglish')}</span>
                    )}
                  </th>
                  <td className={styles.category}>{categoryNames.get(dish.category) || '—'}</td>
                  <td className={`${styles.price} ${styles.alignEnd}`}>{formatPrice(dish.price)}</td>
                  <td>
                    <span className={styles.badges}>
                      {dish.isAvailable ? (
                        <span className={`${styles.badge} ${styles.badgeAvailable}`}>{t('adminDishes.available')}</span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeSoldOut}`}>{t('availability.soldOut')}</span>
                      )}
                      {!dish.isPublished && <span className={styles.badge}>{t('adminDishes.unpublished')}</span>}
                      {dish.isFeatured && <span className={`${styles.badge} ${styles.badgeFeatured}`}>{t('adminDishes.featured')}</span>}
                    </span>
                  </td>
                  <td className={styles.alignEnd}>
                    <span className={styles.actions}>
                      <button
                        type="button"
                        className={`${styles.toggle} ${dish.isAvailable ? '' : styles.toggleRestore}`}
                        aria-label={t(dish.isAvailable ? 'availability.markSoldOutLabel' : 'availability.markAvailableLabel', { code: dish.code, name: dish.name.it })}
                        onClick={() => setDishToToggle(dish)}
                      >
                        {t(dish.isAvailable ? 'availability.markSoldOut' : 'availability.markAvailable')}
                      </button>
                      <button
                        type="button"
                        className={styles.delete}
                        aria-label={t('adminDishes.deleteLabel', { code: dish.code, name: dish.name.it })}
                        onClick={() => setDishToDelete(dish)}
                      >
                        {t('adminDishes.delete')}
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {result.totalPages > 1 && (
          <nav className={styles.pagination} aria-label={t('adminDishes.paginationLabel')}>
            <button type="button" className={styles.pageButton} disabled={page <= 1} onClick={() => goToPage(page - 1)}>
              {t('adminDishes.previous')}
            </button>
            <p className={styles.pageInfo} aria-live="polite">
              {t('adminDishes.page', { page, total: result.totalPages })}
            </p>
            <button type="button" className={styles.pageButton} disabled={page >= result.totalPages} onClick={() => goToPage(page + 1)}>
              {t('adminDishes.next')}
            </button>
          </nav>
        )}
      </>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <p className={styles.kicker}>{t('adminDishes.kicker')}</p>
        <h1 className={styles.title}>{t('adminDishes.title')}</h1>
        <p className={styles.subtitle}>{t('adminDishes.subtitle')}</p>
      </header>

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

      <ConfirmDialog
        open={Boolean(dishToDelete)}
        destructive
        title={dishToDelete && t('adminDishes.deleteTitle', { code: dishToDelete.code, name: dishToDelete.name.it })}
        message={t('adminDishes.deleteMessage')}
        confirmLabel={t('adminDishes.delete')}
        onConfirm={deleteDish}
        onClose={() => setDishToDelete(null)}
      />
    </div>
  )
}

export default AdminDishesPage
