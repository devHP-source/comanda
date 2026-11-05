import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import api from '../../../api/client.js'
import DishCard from '../../../components/DishCard/DishCard.jsx'
import DishCardSkeleton from '../../../components/DishCardSkeleton/DishCardSkeleton.jsx'
import Icon from '../../../components/Icon/Icon.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import WaiterListDialog from '../../../components/WaiterListDialog/WaiterListDialog.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import useList from '../../../hooks/useList.js'
import styles from './ListPage.module.css'

const MAX_SKELETON_CARDS = 4

// /list: the dishes the guest bookmarked, in menu order. Not an order: the waiter still takes it
const ListPage = () => {
  const { t, tError } = useLanguage()
  const { ids, keepOnly } = useList()
  const [dishes, setDishes] = useState(null) // the whole published menu: the list only stores ids
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [isShowingWaiter, setIsShowingWaiter] = useState(false)

  useEffect(() => {
    let ignore = false

    api.get('/dishes')
      .then(({ data }) => {
        if (!ignore) setDishes(data)
      })
      .catch((err) => {
        if (!ignore) setError(err)
      })

    return () => {
      ignore = true
    }
  }, [attempt])

  useEffect(() => { // dishes no longer on the menu leave the list (only after a successful load, never on an error)
    if (dishes) keepOnly(new Set(dishes.map((dish) => dish._id)))
  }, [dishes, keepOnly])

  const saved = useMemo(() => dishes?.filter((dish) => ids.includes(dish._id)) ?? [], [dishes, ids])

  const handleRetry = () => {
    setError(null)
    setAttempt((current) => current + 1)
  }

  let content
  if (ids.length === 0 || (dishes && saved.length === 0)) { // empty: no need to wait for the menu
    content = (
      <div className={styles.message}>
        <span className={styles.emptyIcon} aria-hidden="true">
          <Icon name="bookmark" size={24} />
        </span>
        <h2 className={styles.messageTitle}>{t('list.emptyTitle')}</h2>
        <p className={styles.messageText}>{t('list.emptyText')}</p>
        <Link to="/menu" className={styles.button}>{t('list.browseMenu')}</Link>
      </div>
    )
  } else if (error) {
    content = (
      <div className={styles.message} role="alert">
        <h2 className={styles.messageTitle}>{t('list.errorTitle')}</h2>
        <p className={styles.messageText}>{tError(error)}</p>
        <button type="button" className={styles.button} onClick={handleRetry}>
          {t('menu.retry')}
        </button>
      </div>
    )
  } else if (!dishes) {
    content = (
      <LoadingState slowMessage="list.slow">
        <div className={styles.dishGrid}>
          {Array.from({ length: Math.min(ids.length, MAX_SKELETON_CARDS) }, (_, index) => <DishCardSkeleton key={index} />)}
        </div>
      </LoadingState>
    )
  } else {
    content = (
      <>
        <div className={styles.toolbar}>
          <p className={styles.count}>
            {saved.length === 1 ? t('list.countOne') : t('list.count', { count: saved.length })}
          </p>
          <button type="button" className={styles.button} onClick={() => setIsShowingWaiter(true)}>
            <Icon name="eye" size={18} />
            {t('list.showWaiter')}
          </button>
        </div>

        <div className={styles.dishGrid}>
          {saved.map((dish) => <DishCard key={dish._id} dish={dish} />)}
        </div>

        <WaiterListDialog open={isShowingWaiter} dishes={saved} onClose={() => setIsShowingWaiter(false)} />
      </>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>{t('list.eyebrow')}</p>
        <h1 className={styles.title}>{t('list.title')}</h1>
        <p className={styles.lead}>{t('list.lead')}</p>
      </section>

      <div className={styles.content}>{content}</div>
    </div>
  )
}

export default ListPage
