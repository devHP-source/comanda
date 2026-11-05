import { useEffect, useState } from 'react'
import api from '../../../api/client.js'
import Icon from '../../../components/Icon/Icon.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import kitchenStatus, { romeNow } from '../../../utils/kitchenStatus.js'
import restaurant, { mapUrl } from '../../../utils/restaurant.js'
import styles from './InfoPage.module.css'

const WEEK = [1, 2, 3, 4, 5, 6, 0] // Monday first, as on an Italian calendar (0 = Sunday)

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1) // "lunedì" → "Lunedì"

// 0 → "Sunday" / "domenica". 4 Jan 2026 was a Sunday, so day 4 + weekday is that weekday
const weekdayName = (weekday, lang) =>
  capitalize(new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + weekday))))

// "2027-08-16" → "16 agosto 2027" / "16 August 2027"
const formatDate = (isoDate, lang) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)))
}

// /info: opening hours from the public settings, plus address and phone
const InfoPage = () => {
  const { lang, t } = useLanguage()
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let ignore = false

    api.get('/settings/public')
      .then(({ data }) => {
        if (!ignore) setSettings(data)
      })
      .catch((err) => {
        if (!ignore) setError(err)
      })

    return () => {
      ignore = true
    }
  }, [attempt])

  const handleRetry = () => {
    setError(null)
    setAttempt((current) => current + 1)
  }

  let hours
  if (error) {
    hours = (
      <div className={styles.hoursError} role="alert">
        <p>{t('info.hoursError')}</p>
        <button type="button" className={styles.action} onClick={handleRetry}>
          {t('menu.retry')}
        </button>
      </div>
    )
  } else if (!settings) {
    hours = (
      <LoadingState slowMessage="info.slow">
        <div className={styles.hoursSkeleton}>
          {WEEK.map((weekday) => <Skeleton key={weekday} height="1.25rem" />)}
        </div>
      </LoadingState>
    )
  } else {
    const today = romeNow() // the restaurant's day, wherever the guest is
    const closures = settings.closedDates.filter((date) => date >= today.date).sort() // "YYYY-MM-DD" sorts as text

    hours = (
      <>
        <p className={styles.status}>{t(`menu.${kitchenStatus(settings)}`)}</p>

        <dl className={styles.week}>
          {WEEK.map((weekday) => {
            const isToday = weekday === today.weekday
            const isClosed = settings.closedDays.includes(weekday)

            return (
              <div key={weekday} className={`${styles.day} ${isToday ? styles.today : ''}`}>
                <dt>
                  {weekdayName(weekday, lang)}
                  {isToday && <span className={styles.todayTag}>{t('info.today')}</span>}
                </dt>
                <dd className={isClosed ? styles.closed : ''}>
                  {isClosed ? t('info.closed') : `${settings.openingTime}–${settings.closingTime}`}
                </dd>
              </div>
            )
          })}
        </dl>

        {closures.length > 0 && (
          <div className={styles.closures}>
            <h3 className={styles.closuresTitle}>{t('info.closuresTitle')}</h3>
            <ul className={styles.closuresList}>
              {closures.map((date) => (
                <li key={date}>
                  <time dateTime={date}>{formatDate(date, lang)}</time>
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    )
  }

  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>{t('info.eyebrow')}</p>
        <h1 className={styles.title}>{t('info.title')}</h1>
        <p className={styles.lead}>{t('info.lead')}</p>
      </section>

      <div className={styles.grid}>
        <section className={`${styles.card} ${styles.hoursCard}`} aria-labelledby="info-hours">
          <h2 id="info-hours" className={styles.cardTitle}>
            <Icon name="clock" size={20} />
            {t('info.hoursTitle')}
          </h2>
          {hours}
        </section>

        <section className={styles.card} aria-labelledby="info-address">
          <h2 id="info-address" className={styles.cardTitle}>
            <Icon name="map" size={20} />
            {t('info.addressTitle')}
          </h2>
          <address className={styles.address}>
            Comanda<br />
            {restaurant.street}<br />
            {restaurant.city}
          </address>
          <a href={mapUrl} target="_blank" rel="noopener noreferrer" className={styles.action}>
            {t('info.openMap')}
            <span className="visually-hidden"> ({t('info.newTab')})</span>
          </a>
        </section>

        <section className={styles.card} aria-labelledby="info-contact">
          <h2 id="info-contact" className={styles.cardTitle}>
            <Icon name="phone" size={20} />
            {t('info.contactTitle')}
          </h2>
          <p className={styles.cardText}>{t('info.contactText')}</p>
          <a href={`tel:${restaurant.phone}`} className={`${styles.action} ${styles.primary}`}>
            <Icon name="phone" size={18} />
            <span className="visually-hidden">{t('info.call')} </span>
            {restaurant.phoneDisplay}
          </a>
        </section>
      </div>
    </div>
  )
}

export default InfoPage
