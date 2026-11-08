import { useEffect, useState } from 'react'
import api from '../../../api/client.js'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import SettingsForm from '../../../components/SettingsForm/SettingsForm.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import styles from './AdminSettingsPage.module.css'

// /admin/settings: loads the full settings (admin only) and hands them to the form
const AdminSettingsPage = () => {
  const { t, tError } = useLanguage()
  const [settings, setSettings] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let ignore = false
    api.get('/settings')
      .then(({ data }) => {
        if (ignore) return
        setSettings(data)
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

  let content
  if (loadError) {
    content = (
      <div className={styles.loadError} role="alert">
        <p>{tError(loadError)}</p>
        <button type="button" className={styles.retry} onClick={handleRetry}>{t('menu.retry')}</button>
      </div>
    )
  } else if (!settings) {
    content = (
      <LoadingState slowMessage="availability.slow">
        <div className={styles.skeletons}>
          <Skeleton height="10rem" radius="var(--radius-card)" />
          <Skeleton height="16rem" radius="var(--radius-card)" />
          <Skeleton height="12rem" radius="var(--radius-card)" />
        </div>
      </LoadingState>
    )
  } else {
    content = <SettingsForm settings={settings} />
  }

  return (
    <div className={styles.page}>
      <header>
        <p className={styles.kicker}>{t('adminSettings.kicker')}</p>
        <h1 className={styles.title}>{t('adminSettings.title')}</h1>
        <p className={styles.subtitle}>{t('adminSettings.subtitle')}</p>
      </header>

      {content}
    </div>
  )
}

export default AdminSettingsPage
