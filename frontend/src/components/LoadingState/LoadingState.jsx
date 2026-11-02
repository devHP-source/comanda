import { useEffect, useState } from 'react'
import useLanguage from '../../hooks/useLanguage.js'
import styles from './LoadingState.module.css'

const SHOW_AFTER_MS = 200 // fast loads never flash a skeleton
const SLOW_AFTER_MS = 3000 // Render's free tier can take 30–60 s to wake up

const LoadingState = ({ children, slowMessage = 'loading.slow' }) => { // Wraps a screen's skeletons while its data loads
  const { t } = useLanguage()
  const [phase, setPhase] = useState('waiting') // waiting --> visible --> slow

  useEffect(() => {
    const showTimer = setTimeout(() => setPhase('visible'), SHOW_AFTER_MS)
    const slowTimer = setTimeout(() => setPhase('slow'), SLOW_AFTER_MS)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(slowTimer)
    }
  }, [])

  return (
    <div className={styles.wrapper} aria-busy="true">
      <span className="visually-hidden">{t('loading.label')}</span>
      {phase !== 'waiting' && children}

      <p className={styles.slow} role="status">
        {phase === 'slow' && t(slowMessage)}
      </p>
    </div>
  )
}

export default LoadingState
