import { useEffect, useMemo, useState } from 'react'
import api from '../../../api/client.js'
import CategoryChips from '../../../components/CategoryChips/CategoryChips.jsx'
import CategoryShortcuts from '../../../components/CategoryShortcuts/CategoryShortcuts.jsx'
import CategorySidebar from '../../../components/CategorySidebar/CategorySidebar.jsx'
import DishCard from '../../../components/DishCard/DishCard.jsx'
import DishCardSkeleton from '../../../components/DishCardSkeleton/DishCardSkeleton.jsx'
import FeaturedDishes from '../../../components/FeaturedDishes/FeaturedDishes.jsx'
import Icon from '../../../components/Icon/Icon.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import MenuSearch from '../../../components/MenuSearch/MenuSearch.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import useScrollSpy from '../../../hooks/useScrollSpy.js'
import kitchenStatus from '../../../utils/kitchenStatus.js'
import normalizeText from '../../../utils/normalizeText.js'
import styles from './MenuPage.module.css'

const SKELETON_CARDS = 4
const FAR_JUMP_SCREENS = 2 // farther than this, a smooth scroll would run through half the menu: jump at once

const sectionId = (category) => `category-${category._id}` // anchor for chips, shortcuts and sidebar

// Dish number from its start ("4" --> 4, 47, 4a), names anywhere, in the guest's language and in Italian
const matchesSearch = (dish, search, lang) =>
  normalizeText(dish.code).startsWith(search) ||
  normalizeText(dish.name[lang]).includes(search) ||
  normalizeText(dish.name.it).includes(search)

const MenuPage = () => {
  const { lang, t, pick, tError } = useLanguage()
  const [menu, setMenu] = useState(null) // { categories, dishes, settings }
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0) // "Riprova" bumps it and the effect fetches again
  const [query, setQuery] = useState('')

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

  const search = normalizeText(query)

  const visibleSections = useMemo(() => { // while searching: only the matching dishes, still grouped by category
    if (!search) return sections
    return sections
      .map(({ category, dishes }) => ({ category, dishes: dishes.filter((dish) => matchesSearch(dish, search, lang)) }))
      .filter(({ dishes }) => dishes.length > 0)
  }, [sections, search, lang])

  const featured = useMemo( // sold-out picks are left out of the chef's row
    () => menu?.dishes.filter((dish) => dish.isFeatured && dish.isAvailable) ?? [],
    [menu],
  )

  const sectionIds = useMemo(() => visibleSections.map(({ category }) => sectionId(category)), [visibleSections])
  const activeId = useScrollSpy(sectionIds)

  const navItems = visibleSections.map(({ category }) => ({
    id: sectionId(category),
    label: pick(category.name),
    image: category.coverImage,
  }))

  const handleSelectCategory = (id) => {
    const section = document.getElementById(id)
    if (!section) return
    const isFar = Math.abs(section.getBoundingClientRect().top) > FAR_JUMP_SCREENS * window.innerHeight
    section.scrollIntoView({ block: 'start', behavior: isFar ? 'instant' : 'auto' }) // "auto" follows global.css: smooth only when motion is allowed. The html scroll-padding-top stops it under the sticky bars
    section.querySelector('h2').focus({ preventScroll: true }) // keyboard users continue from the section they jumped to
  }

  const handleClearSearch = () => {
    setQuery('')
    document.getElementById('menu-search').focus() // the button disappears with the empty state: focus goes back to the field
  }

  const handleRetry = () => {
    setError(null)
    setAttempt((current) => current + 1)
  }

  const settings = menu?.settings
  const status = settings && kitchenStatus(settings)
  const hasFrozen = menu?.dishes.some((dish) => dish.isFrozen)
  const resultCount = visibleSections.reduce((sum, { dishes }) => sum + dishes.length, 0)

  let content
  if (error) {
    content = (
      <div className={styles.message} role="alert">
        <h2 className={styles.messageTitle}>{t('menu.errorTitle')}</h2>
        <p className={styles.messageText}>{tError(error)}</p>
        <button type="button" className={styles.button} onClick={handleRetry}>
          {t('menu.retry')}
        </button>
      </div>
    )
  } else if (!menu) {
    content = (
      <LoadingState slowMessage="menu.slow">
        <div className={styles.sections}>
          <div>
            <Skeleton width="11rem" height="1.8rem" className={styles.headingSkeleton} />
            <div className={styles.dishGrid}>
              {Array.from({ length: SKELETON_CARDS }, (_, index) => <DishCardSkeleton key={index} />)}
            </div>
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
    content = (
      <>
        {!search && <CategoryShortcuts items={navItems} onSelect={handleSelectCategory} />}
        {!search && featured.length > 0 && <FeaturedDishes dishes={featured} />}

        {/* Read out after each keystroke, so screen reader users know the list changed */}
        <p className={search ? styles.searchStatus : 'visually-hidden'} role="status">
          {search && resultCount > 0 &&
            t(resultCount === 1 ? 'menu.searchResultsOne' : 'menu.searchResults', { count: resultCount, query: query.trim() })}
        </p>

        {visibleSections.length === 0 ? (
          <div className={styles.message}>
            <h2 className={styles.messageTitle}>{t('menu.searchEmptyTitle', { query: query.trim() })}</h2>
            <p className={styles.messageText}>{t('menu.searchEmptyText')}</p>
            <button type="button" className={styles.button} onClick={handleClearSearch}>
              {t('menu.clearSearch')}
            </button>
          </div>
        ) : (
          <div className={styles.menuBody}>
            {/* Sticky elements stick only inside their parent: this box spans all the sections */}
            <CategoryChips items={navItems} activeId={activeId} onSelect={handleSelectCategory} />

            <div className={styles.sections}>
              {visibleSections.map(({ category, dishes }) => (
                <section
                  key={category._id}
                  id={sectionId(category)}
                  aria-labelledby={`${sectionId(category)}-title`}
                >
                  <div className={styles.sectionHeading}>
                    <h2 id={`${sectionId(category)}-title`} className={styles.sectionTitle} tabIndex={-1}>
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
              ))}
            </div>
          </div>
        )}

        <aside className={styles.note} aria-labelledby="menu-note-title">
          <span className={styles.noteIcon} aria-hidden="true">*</span>
          <div>
            <h2 id="menu-note-title" className={styles.noteTitle}>{t('menu.noteTitle')}</h2>
            {hasFrozen && <p className={styles.noteText}>{t('menu.noteFrozen')}</p>}
            <p className={styles.noteText}>{t('menu.noteAllergens')}</p>
          </div>
        </aside>
      </>
    )
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

      {/* Search first in the DOM, so keyboard users reach it before the 15 categories; on desktop the grid still puts the sidebar on the left */}
      <div className={styles.layout}>
        <MenuSearch value={query} onChange={setQuery} className={styles.searchArea} />
        <CategorySidebar
          items={navItems}
          activeId={activeId}
          onSelect={handleSelectCategory}
          className={styles.sidebarArea}
        />
        <div className={styles.content}>{content}</div>
      </div>
    </div>
  )
}

export default MenuPage
