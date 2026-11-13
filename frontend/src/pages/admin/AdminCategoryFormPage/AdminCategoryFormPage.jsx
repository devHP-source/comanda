import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import api, { getErrorCode } from '../../../api/client.js'
import CategoryForm from '../../../components/CategoryForm/CategoryForm.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import styles from './AdminCategoryFormPage.module.css'

const LIST_PATH = '/admin/categories'
const PICKER_LIMIT = 100 // the biggest category has ~30 dishes: one page holds them all

// Loads the categories (the one being edited, or the next free position for a new one) and, when editing, that category's dishes for the cover picker
const CategoryEditor = ({ categoryId }) => {
  const { t } = useLanguage()
  const [loaded, setLoaded] = useState(null) // { category, dishes, nextOrder }
  const [loadError, setLoadError] = useState(null)
  const [isNotFound, setIsNotFound] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let ignore = false
    Promise.all([
      api.get('/admin/categories'),
      categoryId ? api.get('/admin/dishes', { params: { category: categoryId, limit: PICKER_LIMIT } }) : null,
    ])
      .then(([categoriesResponse, dishesResponse]) => {
        if (ignore) return
        const categories = categoriesResponse.data
        const category = categoryId ? categories.find((item) => item._id === categoryId) : null
        if (categoryId && !category) {
          setIsNotFound(true)
          return
        }
        setLoaded({
          category,
          dishes: dishesResponse?.data.data ?? [],
          nextOrder: Math.max(0, ...categories.map((item) => item.order)) + 1, // a new category goes to the end of the menu
        })
        setLoadError(null)
      })
      .catch((err) => {
        if (ignore) return
        if (getErrorCode(err) === 'INVALID_ID') setIsNotFound(true) // malformed id in the URL
        else setLoadError(err)
      })
    return () => {
      ignore = true
    }
  }, [categoryId, attempt])

  const handleRetry = () => {
    setLoadError(null)
    setAttempt((current) => current + 1)
  }

  const category = loaded?.category

  let content
  if (isNotFound) {
    content = (
      <div className={styles.message} role="alert">
        <p>{t('categoryForm.notFound')}</p>
        <Link to={LIST_PATH} className={styles.retry}>{t('categoryForm.backToList')}</Link>
      </div>
    )
  } else if (loadError) {
    content = (
      <div className={styles.message} role="alert">
        <p>{t('categoryForm.loadError')}</p>
        <button type="button" className={styles.retry} onClick={handleRetry}>{t('menu.retry')}</button>
      </div>
    )
  } else if (!loaded) {
    content = (
      <LoadingState slowMessage="loading.slowData">
        <div className={styles.skeletons}>
          <Skeleton height="16rem" radius="var(--radius-card)" />
          <Skeleton height="14rem" radius="var(--radius-card)" />
        </div>
      </LoadingState>
    )
  } else {
    content = <CategoryForm category={category} dishes={loaded.dishes} nextOrder={loaded.nextOrder} backTo={LIST_PATH} />
  }

  return (
    <div className={styles.page}>
      <Link to={LIST_PATH} className={styles.back}>{t('categoryForm.back')}</Link>
      <header>
        <p className={styles.kicker}>{t('adminCategories.kicker')}</p>
        <h1 className={styles.title}>{t(categoryId ? 'categoryForm.titleEdit' : 'categoryForm.titleNew')}</h1>
        <p className={styles.subtitle}>
          {category ? category.name.it : t(categoryId ? 'loading.label' : 'categoryForm.subtitleNew')}
        </p>
      </header>

      {content}
    </div>
  )
}

// /admin/categories/new and /admin/categories/:id/edit. The key gives each category a fresh form
const AdminCategoryFormPage = () => {
  const { id } = useParams()
  return <CategoryEditor key={id ?? 'new'} categoryId={id} />
}

export default AdminCategoryFormPage
