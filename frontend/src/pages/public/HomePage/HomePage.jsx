import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import api from '../../../api/client.js'
import FeaturedDishes from '../../../components/FeaturedDishes/FeaturedDishes.jsx'
import FeaturedDishesSkeleton from '../../../components/FeaturedDishesSkeleton/FeaturedDishesSkeleton.jsx'
import Icon from '../../../components/Icon/Icon.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Reveal from '../../../components/Reveal/Reveal.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import { WEEK, weekdayName } from '../../../utils/calendar.js'
import kitchenStatus from '../../../utils/kitchenStatus.js'
import styles from './HomePage.module.css'

// "/": the page for people finding us online. Hours from the public settings, chef's picks from the menu
const HomePage = () => {
  const { lang, t } = useLanguage()
  const [settings, setSettings] = useState(null)
  const [settingsError, setSettingsError] = useState(null)
  const [settingsAttempt, setSettingsAttempt] = useState(0)
  const [featured, setFeatured] = useState(null)
  const [featuredError, setFeaturedError] = useState(null)
  const [featuredAttempt, setFeaturedAttempt] = useState(0)

  useEffect(() => {
    let ignore = false

    api.get('/settings/public')
      .then(({ data }) => {
        if (!ignore) setSettings(data)
      })
      .catch((err) => {
        if (!ignore) setSettingsError(err)
      })

    return () => {
      ignore = true
    }
  }, [settingsAttempt])

  useEffect(() => { // Same picks as the menu: featured and not sold out
    let ignore = false

    api.get('/dishes')
      .then(({ data }) => {
        if (!ignore) setFeatured(data.filter((dish) => dish.isFeatured && dish.isAvailable))
      })
      .catch((err) => {
        if (!ignore) setFeaturedError(err)
      })

    return () => {
      ignore = true
    }
  }, [featuredAttempt])

  const handleRetrySettings = () => {
    setSettingsError(null)
    setSettingsAttempt((current) => current + 1)
  }

  const handleRetryFeatured = () => {
    setFeaturedError(null)
    setFeaturedAttempt((current) => current + 1)
  }

  let hours
  if (settingsError) {
    hours = (
      <div className={styles.error} role="alert">
        <p>{t('info.hoursError')}</p>
        <button type="button" className={styles.retry} onClick={handleRetrySettings}>
          {t('menu.retry')}
        </button>
      </div>
    )
  } else if (!settings) {
    hours = (
      <LoadingState slowMessage="home.slow">
        <div className={styles.hoursSkeleton}>
          <Skeleton width="9rem" height="1.3125rem" />
          <Skeleton height="1.5rem" />
          <Skeleton height="1.5rem" />
        </div>
      </LoadingState>
    )
  } else {
    const closedDays = WEEK.filter((weekday) => settings.closedDays.includes(weekday)) // Monday first
    const closedNames = new Intl.ListFormat(lang, { type: 'conjunction' })
      .format(closedDays.map((weekday) => weekdayName(weekday, lang)))

    hours = (
      <>
        <p className={styles.status}>{t(`menu.${kitchenStatus(settings)}`)}</p>
        <dl className={styles.hoursList}>
          <div className={styles.hoursRow}>
            <dt>{t('home.hours')}</dt>
            <dd>{settings.openingTime}–{settings.closingTime}</dd>
          </div>
          <div className={styles.hoursRow}>
            <dt>{t('home.closedOn')}</dt>
            <dd>{closedDays.length > 0 ? closedNames : t('home.openEveryDay')}</dd>
          </div>
        </dl>
      </>
    )
  }

  let picks = null // nothing at all when no dish is featured
  if (featuredError) {
    picks = (
      <div className={`${styles.error} ${styles.picksError}`} role="alert">
        <p>{t('home.featuredError')}</p>
        <button type="button" className={styles.retry} onClick={handleRetryFeatured}>
          {t('menu.retry')}
        </button>
      </div>
    )
  } else if (!featured) {
    picks = (
      <LoadingState quiet>
        <FeaturedDishesSkeleton />
      </LoadingState>
    )
  } else if (featured.length > 0) {
    picks = (
      <Reveal>
        <FeaturedDishes dishes={featured} fromMenu={false} />
      </Reveal>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroText}>
          <p className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">C</span>
            <span>Comanda · {t('brand.note')}</span>
          </p>
          <h1 id="home-title" className={styles.title}>{t('home.title')}</h1>
          <p className={styles.lead}>{t('home.lead')}</p>

          <div className={styles.actions}>
            <Link to="/menu" className={`${styles.button} ${styles.primary}`}>
              <Icon name="menu" size={18} />
              {t('home.seeMenu')}
            </Link>
            <Link to="/book" className={styles.button}>
              <Icon name="calendar" size={18} />
              {t('home.bookTable')}
            </Link>
          </div>
        </div>

        <Reveal className={styles.hoursArea}>
          <section className={styles.card} aria-labelledby="home-hours">
            <h2 id="home-hours" className={styles.cardTitle}>
              <Icon name="clock" size={20} />
              {t('info.hoursTitle')}
            </h2>
            {hours}
          </section>
        </Reveal>
      </section>

      <div className={styles.picks}>{picks}</div>

      <Reveal>
        <section className={styles.about} aria-labelledby="home-about">
          <p className={styles.kicker}>{t('nav.about')}</p>
          <h2 id="home-about" className={styles.aboutTitle}>{t('home.aboutTitle')}</h2>
          <p className={styles.aboutText}>{t('home.aboutText')}</p>
          <Link to="/info" className={styles.button}>
            <Icon name="map" size={18} />
            {t('home.aboutLink')}
          </Link>
        </section>
      </Reveal>
    </div>
  )
}

export default HomePage
