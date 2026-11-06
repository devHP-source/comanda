import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import api, { getErrorCode } from '../../../api/client.js'
import DishForm from '../../../components/DishForm/DishForm.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import styles from './AdminDishFormPage.module.css'

const LIST_PATH = '/admin/dishes'
const NOT_FOUND_CODES = ['DISH_NOT_FOUND', 'INVALID_ID']

// Loads the categories (and the dish when editing), then shows the form. One instance per dish: see AdminDishFormPage below
const DishEditor = ({ dishId }) => {
  const { t } = useLanguage()
  const location = useLocation()
  const back = location.state?.back
  const backTo = typeof back === 'string' && back.startsWith(LIST_PATH) ? back : LIST_PATH // the list page the admin came from (?page=2)
  const [loaded, setLoaded] = useState(null) // { dish, categories }
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let ignore = false
    Promise.all([
      api.get('/categories'),
      dishId ? api.get(`/admin/dishes/${dishId}`) : null, // admin route: unpublished dishes too
    ])
      .then(([categoriesResponse, dishResponse]) => {
        if (ignore) return
        setLoaded({ categories: categoriesResponse.data, dish: dishResponse?.data ?? null })
        setLoadError(null)
      })
      .catch((err) => {
        if (!ignore) setLoadError(err)
      })
    return () => {
      ignore = true
    }
  }, [dishId, attempt])

  const handleRetry = () => {
    setLoadError(null)
    setAttempt((current) => current + 1)
  }

  const dish = loaded?.dish

  let content
  if (loadError && NOT_FOUND_CODES.includes(getErrorCode(loadError))) {
    content = (
      <div className={styles.message} role="alert">
        <p>{t('dishForm.notFound')}</p>
        <Link to={backTo} className={styles.retry}>{t('dishForm.backToList')}</Link>
      </div>
    )
  } else if (loadError) {
    content = (
      <div className={styles.message} role="alert">
        <p>{t('dishForm.loadError')}</p>
        <button type="button" className={styles.retry} onClick={handleRetry}>{t('menu.retry')}</button>
      </div>
    )
  } else if (!loaded) {
    content = (
      <LoadingState slowMessage="availability.slow">
        <div className={styles.skeletons}>
          <Skeleton height="24rem" radius="var(--radius-card)" />
          <Skeleton height="20rem" radius="var(--radius-card)" />
        </div>
      </LoadingState>
    )
  } else {
    content = <DishForm dish={dish} categories={loaded.categories} backTo={backTo} />
  }

  return (
    <div className={styles.page}>
      <Link to={backTo} className={styles.back}>{t('dishForm.back')}</Link>
      <header>
        <p className={styles.kicker}>{t('adminDishes.kicker')}</p>
        <h1 className={styles.title}>{t(dishId ? 'dishForm.titleEdit' : 'dishForm.titleNew')}</h1>
        <p className={styles.subtitle}>
          {dish ? `${dish.code} · ${dish.name.it}` : t(dishId ? 'loading.label' : 'dishForm.subtitleNew')}
        </p>
      </header>

      {content}
    </div>
  )
}

// /admin/dishes/new and /admin/dishes/:id/edit. The key gives each dish a fresh form (no values left over from the previous one)
const AdminDishFormPage = () => {
  const { id } = useParams()
  return <DishEditor key={id ?? 'new'} dishId={id} />
}

export default AdminDishFormPage
