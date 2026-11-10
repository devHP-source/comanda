import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useMatch, useSearchParams } from 'react-router'
import api from '../../../api/client.js'
import CategoryChips from '../../../components/CategoryChips/CategoryChips.jsx'
import CategoryChipsSkeleton from '../../../components/CategoryChipsSkeleton/CategoryChipsSkeleton.jsx'
import CategoryShortcuts from '../../../components/CategoryShortcuts/CategoryShortcuts.jsx'
import CategoryShortcutsSkeleton from '../../../components/CategoryShortcutsSkeleton/CategoryShortcutsSkeleton.jsx'
import CategorySidebar from '../../../components/CategorySidebar/CategorySidebar.jsx'
import DishCard from '../../../components/DishCard/DishCard.jsx'
import DishCardSkeleton from '../../../components/DishCardSkeleton/DishCardSkeleton.jsx'
import DishRow from '../../../components/DishRow/DishRow.jsx'
import FeaturedDishes from '../../../components/FeaturedDishes/FeaturedDishes.jsx'
import FeaturedDishesSkeleton from '../../../components/FeaturedDishesSkeleton/FeaturedDishesSkeleton.jsx'
import Icon from '../../../components/Icon/Icon.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import MenuSearch from '../../../components/MenuSearch/MenuSearch.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import useList from '../../../hooks/useList.js'
import kitchenStatus from '../../../utils/kitchenStatus.js'
import normalizeText from '../../../utils/normalizeText.js'
import styles from './MenuPage.module.css'

const SKELETON_CARDS = 4
const CATEGORY_TITLE_ID = 'menu-category-title' // heading of the category on screen: gets the focus after a switch
const LOW_ON_SCREEN = 2 / 3 // after a switch, a list starting below this share of the screen height is brought up

// Dish number from its start ("4" --> 4, 47, 4a), names anywhere, in the guest's language and in Italian
const matchesSearch = (dish, search, lang) =>
  normalizeText(dish.code).startsWith(search) ||
  normalizeText(dish.name[lang]).includes(search) ||
  normalizeText(dish.name.it).includes(search)

// Compact categories (Bevande): one line per dish, no photo. The others: cards with the photo
const renderDishes = (category, dishes) => (
  category.isCompact ? (
    <ul className={styles.compactList}>
      {dishes.map((dish) => <li key={dish._id}><DishRow dish={dish} /></li>)}
    </ul>
  ) : (
    <div className={styles.dishGrid}>
      {dishes.map((dish) => <DishCard key={dish._id} dish={dish} />)}
    </div>
  )
)

const MenuPage = () => {
  const { lang, t, pick, tError } = useLanguage()
  const { count: listCount } = useList()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const dishMatch = useMatch('/menu/dish/:id') // the dish sheet open over the menu, if any
  const pendingFocusRef = useRef(null) // category chosen by the guest, waiting to be on screen
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

  const searchSections = useMemo(() => { // while searching: the matching dishes of the whole menu, still grouped by category
    if (!search) return []
    return sections
      .map(({ category, dishes }) => ({ category, dishes: dishes.filter((dish) => matchesSearch(dish, search, lang)) }))
      .filter(({ dishes }) => dishes.length > 0)
  }, [sections, search, lang])

  const featured = useMemo( // sold-out picks are left out of the chef's row
    () => menu?.dishes.filter((dish) => dish.isFeatured && dish.isAvailable) ?? [],
    [menu],
  )

  // The category on screen: the one in the URL. Without it (or with an unknown id): a shared dish link shows the dish's
  // own category behind the sheet, everything else the first category
  const sharedDish = dishMatch && !location.state?.fromMenu
    ? menu?.dishes.find((dish) => dish._id === dishMatch.params.id)
    : null
  const selected =
    sections.find(({ category }) => category._id === searchParams.get('category')) ??
    sections.find(({ category }) => category._id === sharedDish?.category) ??
    sections[0]
  const activeId = search ? null : selected?.category._id ?? null // while searching no chip is active

  useEffect(() => { // No dependencies on purpose: runs after every render, acts once the chosen category is the one on screen
    if (!pendingFocusRef.current || pendingFocusRef.current !== activeId) return
    pendingFocusRef.current = null
    const heading = document.getElementById(CATEGORY_TITLE_ID)
    const list = heading?.closest('section')
    if (!list) return

    // scroll-padding-top = height of the sticky bars (top bar, + chips under 1024px): the list must start under them
    const barsHeight = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
    const { top } = list.getBoundingClientRect()
    if (top < barsHeight || top > window.innerHeight * LOW_ON_SCREEN) {
      list.scrollIntoView({ block: 'start' }) // smooth only when motion is allowed (global.css)
    }
    heading.focus({ preventScroll: true }) // keyboard and screen reader users continue from the new list
  })

  const navItems = sections.map(({ category }) => ({
    id: category._id,
    label: pick(category.name),
    image: category.coverImage,
  }))

  const handleSelectCategory = (id) => { // chips, shortcuts and sidebar. Also ends a search
    pendingFocusRef.current = id
    setQuery('')
    setSearchParams({ category: id }, { replace: true }) // replace: Back leaves the menu instead of stepping through categories
  }

  const handleClearSearch = () => {
    setQuery('')
    document.getElementById('menu-search').focus() // the button disappears with the empty state: focus goes back to the field
  }

  const handleRetry = () => {
    setError(null)
    setAttempt((current) => current + 1)
  }

  const renderSection = ({ category, dishes }, titleId) => (
    <section key={category._id} aria-labelledby={titleId}>
      <div className={styles.sectionHeading}>
        <h2 id={titleId} className={styles.sectionTitle} tabIndex={-1}>
          {pick(category.name)}
        </h2>
        <p className={styles.sectionCount}>
          {dishes.length === 1 ? t('menu.dishCountOne') : t('menu.dishCount', { count: dishes.length })}
        </p>
      </div>
      {renderDishes(category, dishes)}
    </section>
  )

  const settings = menu?.settings
  const status = settings && kitchenStatus(settings)
  const hasFrozen = menu?.dishes.some((dish) => dish.isFrozen)
  const resultCount = searchSections.reduce((sum, { dishes }) => sum + dishes.length, 0)

  let results
  if (!search) {
    results = selected && renderSection(selected, CATEGORY_TITLE_ID) // undefined only while the menu loads or is empty
  } else if (searchSections.length === 0) {
    results = (
      <div className={styles.message}>
        <h2 className={styles.messageTitle}>{t('menu.searchEmptyTitle', { query: query.trim() })}</h2>
        <p className={styles.messageText}>{t('menu.searchEmptyText')}</p>
        <button type="button" className={styles.button} onClick={handleClearSearch}>
          {t('menu.clearSearch')}
        </button>
      </div>
    )
  } else {
    results = (
      <div className={styles.sections}>
        {searchSections.map((section) => renderSection(section, `search-${section.category._id}-title`))}
      </div>
    )
  }

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
        <div>
          <CategoryShortcutsSkeleton />
          <FeaturedDishesSkeleton />

          <div className={styles.menuBody}>
            <CategoryChipsSkeleton />

            <div>
              <Skeleton width="11rem" height="1.8rem" className={styles.headingSkeleton} />
              <div className={styles.dishGrid}>
                {Array.from({ length: SKELETON_CARDS }, (_, index) => <DishCardSkeleton key={index} />)}
              </div>
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
        {!search && <CategoryShortcuts items={navItems} activeId={activeId} onSelect={handleSelectCategory} />}
        {!search && featured.length > 0 && <FeaturedDishes dishes={featured} />}

        {/* Read out after each keystroke, so screen reader users know the list changed */}
        <p className={search ? styles.searchStatus : 'visually-hidden'} role="status">
          {search && resultCount > 0 &&
            t(resultCount === 1 ? 'menu.searchResultsOne' : 'menu.searchResults', { count: resultCount, query: query.trim() })}
        </p>

        <div className={styles.menuBody}>
          {/* Sticky elements stick only inside their parent: this box spans the whole list */}
          <CategoryChips items={navItems} activeId={activeId} onSelect={handleSelectCategory} />
          {results}
        </div>

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

        <p className={styles.status}>
          {settings && (
            <>
              <Icon name="clock" size={15} />
              {t(`menu.${status}`)}
              <span className={styles.statusSeparator} aria-hidden="true" />
              <span className="visually-hidden">{t('menu.hours')}: </span>
              {settings.openingTime}–{settings.closingTime}
            </>
          )}
        </p>
      </section>

      <div className={styles.layout}>
        <div className={`${styles.searchRow} ${styles.searchArea}`}>
          <MenuSearch value={query} onChange={setQuery} className={styles.search} />
          <Link to="/list" className={styles.listLink}>
            <Icon name="bookmark" size={18} />
            {t('nav.list')}
            {listCount > 0 && (
              <>
                <span className={styles.listCount} aria-hidden="true">{listCount}</span>
                <span className="visually-hidden">
                  {' '}({listCount === 1 ? t('list.countOne') : t('list.count', { count: listCount })})
                </span>
              </>
            )}
          </Link>
        </div>
        <CategorySidebar
          items={navItems}
          activeId={activeId}
          onSelect={handleSelectCategory}
          isLoading={!menu && !error}
          className={styles.sidebarArea}
        />
        <div className={styles.content}>{content}</div>
      </div>

      <Outlet context={menu} />
    </div>
  )
}

export default MenuPage
