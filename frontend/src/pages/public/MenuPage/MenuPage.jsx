import { useEffect, useMemo, useState } from 'react'
import api from '../../../api/client.js'
import DishCard from '../../../components/DishCard/DishCard.jsx'
import DishCardSkeleton from '../../../components/DishCardSkeleton/DishCardSkeleton.jsx'
import Icon from '../../../components/Icon/Icon.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import kitchenStatus from '../../../utils/kitchenStatus.js'
import styles from './MenuPage.module.css'

const SKELETON_CARDS = 4

const MenuPage = () => {
  const { t, pick, tError } = useLanguage()
  const [menu, setMenu] = useState(null) // { categories, dishes, settings }
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0) // "Riprova" bumps it and the effect fetches again

  useEffect(() => { // The whole menu once: categories in menu order, dishes sorted by code
    let ignore = false

    Promise.all([
      api.get('/categories'),
      api.get('/dishes'),
      api.get('/settings/public').catch(() => null), // only the hours line needs it: the menu shows anyway
    ])
      .then(([categories, dishes, settings]) => {
        if (ignore) return
        setMenu({ categories: categories.data, dishes: dishes.data, settings: settings?.data ?? null })
      })
      .catch((err) => {
        if (!ignore) setError(err)
      })

    return () => {
      ignore = true
    }
  }, [attempt])

  const sections = useMemo(() => { // [{ category, dishes }], empty categories left out
    if (!menu) return []

    const dishesByCategory = new Map()
    for (const dish of menu.dishes) {
      if (!dishesByCategory.has(dish.category)) dishesByCategory.set(dish.category, [])
      dishesByCategory.get(dish.category).push(dish)
    }

    return menu.categories
      .filter((category) => dishesByCategory.has(category._id))
      .map((category) => ({ category, dishes: dishesByCategory.get(category._id) }))
  }, [menu])

  const handleRetry = () => {
    setError(null)
    setAttempt((current) => current + 1)
  }

  const settings = menu?.settings
  const status = settings && kitchenStatus(settings)
  const hasFrozen = menu?.dishes.some((dish) => dish.isFrozen)

  let content
  if (error) {
    content = (
      <div className={styles.message} role="alert">
        <h2 className={styles.messageTitle}>{t('menu.errorTitle')}</h2>
        <p className={styles.messageText}>{tError(error)}</p>
        <button type="button" className={styles.retry} onClick={handleRetry}>
          {t('menu.retry')}
        </button>
      </div>
    )
  } else if (!menu) {
    content = (
      <LoadingState slowMessage="menu.slow">
        <div className={styles.section}>
          <Skeleton width="11rem" height="1.8rem" className={styles.headingSkeleton} />
          <div className={styles.dishGrid}>
            {Array.from({ length: SKELETON_CARDS }, (_, index) => <DishCardSkeleton key={index} />)}
          </div>
        </div>
      </LoadingState>
    )
  } else if (sections.length === 0) {
    content = (
      <div className={styles.message}>
        <p className={styles.messageText}>{t('menu.empty')}</p>
      </div>
    )
  } else {
    content = sections.map(({ category, dishes }) => (
      <section
        key={category._id}
        id={`category-${category._id}`} // anchor for the category chips
        className={styles.section}
        aria-labelledby={`category-title-${category._id}`}
      >
        <div className={styles.sectionHeading}>
          <h2 id={`category-title-${category._id}`} className={styles.sectionTitle}>
            {pick(category.name)}
          </h2>
          <p className={styles.sectionCount}>
            {dishes.length === 1 ? t('menu.dishCountOne') : t('menu.dishCount', { count: dishes.length })}
          </p>
        </div>
        <div className={styles.dishGrid}>
          {dishes.map((dish) => <DishCard key={dish._id} dish={dish} />)}
        </div>
      </section>
    ))
  }

  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>{t('menu.eyebrow')}</p>
        <h1 className={styles.title}>{t('menu.title')}</h1>
        <p className={styles.lead}>{t('menu.lead')}</p>

        {/* Empty until the settings arrive: its min-height keeps the page still */}
        <p className={styles.status}>
          {settings && (
            <>
              <span className={`${styles.statusDot} ${status === 'open' ? styles.isOpen : ''}`} aria-hidden="true" />
              {t(`menu.${status}`)}
              <span className={styles.statusSeparator} aria-hidden="true" />
              <Icon name="clock" size={15} />
              <span className="visually-hidden">{t('menu.hours')}: </span>
              {settings.openingTime}–{settings.closingTime}
            </>
          )}
        </p>
      </section>

      <div className={styles.sections}>{content}</div>

      {menu && sections.length > 0 && (
        <aside className={styles.note} aria-labelledby="menu-note-title">
          <span className={styles.noteIcon} aria-hidden="true">*</span>
          <div>
            <h2 id="menu-note-title" className={styles.noteTitle}>{t('menu.noteTitle')}</h2>
            {hasFrozen && <p className={styles.noteText}>{t('menu.noteFrozen')}</p>}
            <p className={styles.noteText}>{t('menu.noteAllergens')}</p>
          </div>
        </aside>
      )}
    </div>
  )
}

export default MenuPage
