import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import api from '../../../api/client.js'
import DishVisual from '../../../components/DishVisual/DishVisual.jsx'
import Icon from '../../../components/Icon/Icon.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import thumbnailUrl from '../../../utils/thumbnailUrl.js'
import styles from './AdminCategoriesPage.module.css'

const SKELETON_ROWS = 8
const ROW_THUMBNAIL = 'c_fill,ar_4:3,f_auto,q_auto,w_160' // same 4:3 crop as the menu shortcuts

// /admin/categories: every category in menu order (only 15, no pagination), with its preview photo and dish count.
// Desktop: a table, the name links to the edit form. Phones and tablets: one card per category, the whole card opens the form
const AdminCategoriesPage = () => {
  const { t, tError } = useLanguage()
  const [categories, setCategories] = useState(null) // null until the first answer
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)

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

  const handleRetry = () => {
    setLoadError(null)
    setAttempt((current) => current + 1)
  }

  const dishesLabel = (count) => (count === 1 ? t('menu.dishCountOne') : t('menu.dishCount', { count }))

  // Shared by the table and the cards
  const photo = (category) => (
    <span className={styles.photo}>
      {category.coverImage ? (
        <img src={thumbnailUrl(category.coverImage, ROW_THUMBNAIL)} alt="" loading="lazy" width="64" height="48" />
      ) : (
        <DishVisual seed={category.name.it} />
      )}
    </span>
  )

  const editLink = (category, className) => (
    <Link
      to={`/admin/categories/${category._id}/edit`}
      className={className}
      aria-label={t('adminCategories.editLabel', { name: category.name.it })}
    >
      {category.name.it}
    </Link>
  )

  const details = (category) => (
    <>
      {category.name.en?.trim() ? (
        <span className={styles.nameEn} lang="en">{category.name.en}</span>
      ) : (
        <span className={styles.missing}>{t('adminDishes.missingEnglish')}</span>
      )}
      <span className={styles.coverNote}>
        {t(category.coverDish ? 'adminCategories.coverChosen' : 'adminCategories.coverAuto')}
      </span>
    </>
  )

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
      <LoadingState slowMessage="loading.slowData">
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

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="visually-hidden">{t('adminCategories.tableLabel')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('adminCategories.columns.order')}</th>
                <th scope="col"><span className="visually-hidden">{t('adminCategories.columns.photo')}</span></th>
                <th scope="col">{t('adminCategories.columns.name')}</th>
                <th scope="col" className={styles.alignEnd}>{t('adminCategories.columns.dishes')}</th>
                <th scope="col"><span className="visually-hidden">{t('adminCategories.columns.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category._id}>
                  <td><span className={styles.order}>{category.order}</span></td>
                  <td className={styles.photoCell}>{photo(category)}</td>
                  <th scope="row" className={styles.name}>
                    {editLink(category, styles.nameLink)}
                    {details(category)}
                  </th>
                  <td className={`${styles.count} ${styles.alignEnd}`}>{dishesLabel(category.dishCount)}</td>
                  <td className={styles.actionsCell}>
                    <Link
                      to={`/admin/categories/${category._id}/edit`}
                      className={styles.editButton}
                      aria-label={t('adminCategories.editLabel', { name: category.name.it })}
                      title={t('adminCategories.editLabel', { name: category.name.it })}
                    >
                      <Icon name="pencil" size={20} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className={styles.cards} aria-label={t('adminCategories.tableLabel')}>
          {categories.map((category) => (
            <li key={category._id} className={styles.card}>
              {photo(category)}
              <div className={styles.cardBody}>
                <p className={styles.cardMeta}>
                  <span className={styles.order}>{category.order}</span>
                  <span className={styles.count}>{dishesLabel(category.dishCount)}</span>
                </p>
                <h2 className={styles.cardName}>{editLink(category, styles.cardLink)}</h2>
                {details(category)}
              </div>
            </li>
          ))}
        </ul>
      </>
    )
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
    </div>
  )
}

export default AdminCategoriesPage
