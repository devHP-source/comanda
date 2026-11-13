import { useEffect, useState } from 'react'
import useLanguage from '../../hooks/useLanguage.js'
import styles from './LoadingState.module.css'

const SHOW_AFTER_MS = 200 // fast loads never flash a skeleton
const SLOW_AFTER_MS = 3000 // Render's free tier can take 30–60 s to wake up

/*
* Wraps a screen's skeletons while its data loads. `shell` (optional) draws a full-height page frame around them:
* the slow line goes inside the frame, under the skeletons, not after the whole page
* `quiet`: a second loading region on a screen that already has one. Same delay and aria-busy,
* only the main region says "Caricamento…" and shows the slow line
*/
const LoadingState = ({ children, slowMessage = 'loading.slow', shell, quiet = false }) => {
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

  if (quiet) return <div aria-busy="true">{phase !== 'waiting' && children}</div>

  const label = <span className="visually-hidden">{t('loading.label')}</span>
  const slowLine = (
    <p className={styles.slow} role="status">
      {phase === 'slow' && t(slowMessage)}
    </p>
  )

  if (shell) {
    return (
      <div aria-busy="true">
        {label}
        {phase !== 'waiting' && shell(
          <div className={styles.wrapper}>
            {children}
            {slowLine}
          </div>,
        )}
      </div>
    )
  }

  return (
    <div className={styles.wrapper} aria-busy="true">
      {label}
      {phase !== 'waiting' && children}
      {slowLine}
    </div>
  )
}

export default LoadingState
