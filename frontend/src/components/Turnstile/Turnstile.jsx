import { useEffect, useRef, useState } from 'react'
import useLanguage from '../../hooks/useLanguage.js'
import styles from './Turnstile.module.css'

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit' // explicit: the widget is drawn only when we call render()
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY
const FULL_WIDTH = 300 // the smallest width of the normal widget: narrower phones get the compact one, so the page never scrolls sideways

let scriptPromise = null // shared by every mount: the script is added to the page once

const loadScript = () => {
  if (window.turnstile) return Promise.resolve(window.turnstile)

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_URL
      script.onload = () => resolve(window.turnstile)
      script.onerror = () => { // usually an ad-blocker: forget this attempt so "Riprova" really loads it again
        script.remove()
        scriptPromise = null
        reject(new Error('Turnstile script could not be loaded'))
      }
      document.head.append(script)
    })
  }

  return scriptPromise
}

// Cloudflare's bot check. Gives the parent a token (or null when there is none) through onToken, which must be stable: a state setter.
// A token works once: to get a new widget after a failed request, the parent changes this component's `key`
const Turnstile = ({ onToken }) => {
  const { lang, t } = useLanguage()
  const containerRef = useRef(null)
  const [isBlocked, setIsBlocked] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => { // a new language draws a new widget: Turnstile can't change the language of one already drawn
    let ignore = false
    let widgetId = null

    loadScript()
      .then((turnstile) => {
        if (ignore) return
        widgetId = turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          language: lang,
          theme: 'light',
          size: containerRef.current.offsetWidth >= FULL_WIDTH ? 'flexible' : 'compact',
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(null), // after about 5 minutes: the widget gets a new token by itself and calls callback again
          'error-callback': () => onToken(null),
        })
      })
      .catch(() => {
        if (!ignore) setIsBlocked(true)
      })

    return () => {
      ignore = true
      if (widgetId !== null) window.turnstile.remove(widgetId)
      onToken(null) // the old widget's token goes with it
    }
  }, [lang, attempt, onToken])

  const handleRetry = () => {
    setIsBlocked(false)
    setAttempt((current) => current + 1)
  }

  return (
    <div className={styles.wrapper} role="group" aria-label={t('booking.captcha.label')}>
      <div ref={containerRef} className={isBlocked ? styles.gone : styles.widget} />
      {isBlocked && (
        <div className={styles.blocked} role="alert">
          <p>{t('booking.captcha.blocked')}</p>
          <button type="button" className={styles.retry} onClick={handleRetry}>{t('menu.retry')}</button>
        </div>
      )}
    </div>
  )
}

export default Turnstile
