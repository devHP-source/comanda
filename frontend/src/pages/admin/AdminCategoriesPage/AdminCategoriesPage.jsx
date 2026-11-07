import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import api from '../../../api/client.js'
import ConfirmDialog from '../../../components/ConfirmDialog/ConfirmDialog.jsx'
import DishVisual from '../../../components/DishVisual/DishVisual.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import thumbnailUrl from '../../../utils/thumbnailUrl.js'
import styles from './AdminCategoriesPage.module.css'

const SKELETON_ROWS = 8
const ROW_THUMBNAIL = 'c_fill,ar_4:3,f_auto,q_auto,w_160' // same 4:3 crop as the menu shortcuts

// /admin/categories: every category in menu order (only 15, no pagination), with its preview photo and dish count
const AdminCategoriesPage = () => {
  const { t, tError } = useLanguage()
  const [categories, setCategories] = useState(null) // null until the first answer
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [categoryToDelete, setCategoryToDelete] = useState(null)

  useEffect(() => {
    let ignore = false
    api.get('/admin/categories') // admin route: dishCount counts unpublished dishes too
      .then(({ data }) => {
        if (ignore) return
        setCategories(data)
        setLoadError(null)
      })
      .catch((err) => {
        if (!ignore) setLoadError(err)
      })
    return () => {
      ignore = true
    }
  }, [attempt])

  const reload = () => setAttempt((current) => current + 1)

  const handleRetry = () => {
    setLoadError(null)
    reload()
  }

  const dishesLabel = (count) => (count === 1 ? t('menu.dishCountOne') : t('menu.dishCount', { count }))

  const deleteCategory = async () => {
    const { _id, name } = categoryToDelete
    try {
      await api.delete(`/categories/${_id}`)
      toast.success(t('adminCategories.deleted', { name: name.it }))
    } catch (err) {
      toast.error(tError(err)) // 409 CATEGORY_HAS_DISHES: the server is the one that knows the current dish count
    }
    reload() // the counts on screen may be out of date either way
  }

  let content
  if (!categories && loadError) {
    content = (
      <div className={styles.loadError} role="alert">
        <p>{t('adminCategories.loadError')}</p>
        <button type="button" className={styles.retry} onClick={handleRetry}>{t('menu.retry')}</button>
      </div>
    )
  } else if (!categories) {
    content = (
      <LoadingState slowMessage="availability.slow">
        <div className={styles.skeletons}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} height="4.5rem" radius="var(--radius-md)" />
          ))}
        </div>
      </LoadingState>
    )
  } else if (categories.length === 0) {
    content = <p className={styles.empty}>{t('adminCategories.empty')}</p>
  } else {
    content = (
      <>
        {loadError && (
          <p className={styles.stale} role="alert">
            {tError(loadError)}
            <button type="button" className={styles.staleRetry} onClick={handleRetry}>{t('menu.retry')}</button>
          </p>
        )}

        <div className={styles.tableWrap} role="region" aria-labelledby="categories-caption" tabIndex={0}>
          <table className={styles.table}>
            <caption id="categories-caption" className="visually-hidden">{t('adminCategories.tableLabel')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('adminCategories.columns.order')}</th>
                <th scope="col"><span className="visually-hidden">{t('adminCategories.columns.photo')}</span></th>
                <th scope="col">{t('adminCategories.columns.name')}</th>
                <th scope="col">{t('adminCategories.columns.dishes')}</th>
                <th scope="col" className={styles.alignEnd}>{t('adminCategories.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category._id}>
                  <td><span className={styles.order}>{category.order}</span></td>
                  <td>
                    <span className={styles.photo}>
                      {category.coverImage ? (
                        <img src={thumbnailUrl(category.coverImage, ROW_THUMBNAIL)} alt="" loading="lazy" width="64" height="48" />
                      ) : (
                        <DishVisual seed={category.name.it} />
                      )}
                    </span>
                  </td>
                  <th scope="row" className={styles.name}>
                    <span className={styles.nameIt}>{category.name.it}</span>
                    {category.name.en?.trim() ? (
                      <span className={styles.nameEn} lang="en">{category.name.en}</span>
                    ) : (
                      <span className={styles.missing}>{t('adminDishes.missingEnglish')}</span>
                    )}
                    <span className={styles.coverNote}>
                      {t(category.coverDish ? 'adminCategories.coverChosen' : 'adminCategories.coverAuto')}
                    </span>
                  </th>
                  <td className={styles.count}>{dishesLabel(category.dishCount)}</td>
                  <td className={styles.alignEnd}>
                    <span className={styles.actions}>
                      <Link
                        to={`/admin/categories/${category._id}/edit`}
                        className={styles.edit}
                        aria-label={t('adminCategories.editLabel', { name: category.name.it })}
                      >
                        {t('adminCategories.edit')}
                      </Link>
                      <button
                        type="button"
                        className={styles.delete}
                        aria-label={t('adminCategories.deleteLabel', { name: category.name.it })}
                        onClick={() => setCategoryToDelete(category)}
                      >
                        {t('adminCategories.delete')}
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  let deleteMessage = t('adminCategories.deleteMessage')
  if (categoryToDelete?.dishCount > 0) {
    deleteMessage = t('adminCategories.deleteMessageWithDishes', { dishes: dishesLabel(categoryToDelete.dishCount) })
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.kicker}>{t('adminCategories.kicker')}</p>
          <h1 className={styles.title}>{t('adminCategories.title')}</h1>
          <p className={styles.subtitle}>{t('adminCategories.subtitle')}</p>
        </div>
        <Link to="/admin/categories/new" className={styles.newCategory}>{t('adminCategories.newCategory')}</Link>
      </header>

      {content}

      <ConfirmDialog
        open={Boolean(categoryToDelete)}
        destructive
        title={categoryToDelete && t('adminCategories.deleteTitle', { name: categoryToDelete.name.it })}
        message={deleteMessage}
        confirmLabel={t('adminCategories.delete')}
        onConfirm={deleteCategory}
        onClose={() => setCategoryToDelete(null)}
      />
    </div>
  )
}

export default AdminCategoriesPage
