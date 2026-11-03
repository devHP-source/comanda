import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { toast } from 'sonner'
import Icon from '../../../components/Icon/Icon.jsx'
import LanguagePill from '../../../components/LanguagePill/LanguagePill.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import useAuth from '../../../hooks/useAuth.js'
import useLanguage from '../../../hooks/useLanguage.js'
import roleHome from '../../../utils/roleHome.js'
import styles from './StaffLoginPage.module.css'

const StaffLoginPage = () => {
  const { t, tError } = useLanguage()
  const { user, isChecking, login } = useAuth()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  if (isChecking) {
    return (
      <main className={styles.page}>
        <LoadingState slowMessage="auth.checkingSlow" />
      </main>
    )
  }

  if (user) { // Logged in (just now or before a reload), back to the page that asked for login if it belongs to this role, else the role's screen
    const home = roleHome(user.role)
    const from = location.state?.from
    return <Navigate to={from?.startsWith(home) ? from : home} replace />
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      await login(form.email.trim(), form.password) // success: user is set and this page redirects
    } catch (error) {
      toast.error(tError(error))
      setIsSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.topRow}>
        <Link to="/menu" className={styles.back}>
          {t('login.backToMenu')}
        </Link>
        <LanguagePill />
      </div>

      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">C</span>
          <span className={styles.brandName}>Comanda</span>
        </div>

        <p className={styles.kicker}>{t('login.kicker')}</p>
        <h1 id="login-title" className={styles.title}>{t('login.title')}</h1>
        <p className={styles.text}>{t('login.text')}</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>{t('login.email')}</span>
            <input
              className={styles.input}
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              required
              value={form.email}
              onChange={handleChange}
            />
          </label>

          <div className={styles.field}>
            <label htmlFor="login-password" className={styles.label}>{t('login.password')}</label>
            <div className={styles.passwordWrap}>
              <input
                id="login-password"
                className={`${styles.input} ${styles.passwordInput}`}
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={handleChange}
              />
              <button
                type="button"
                className={styles.toggle}
                aria-label={t('login.showPassword')}
                aria-pressed={showPassword} // fixed label, the state is in aria-pressed: no "Hide password, pressed" double message
                onClick={() => setShowPassword((current) => !current)}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} />
              </button>
            </div>
          </div>

          <button type="submit" className={styles.submit} disabled={isSubmitting}>
            {isSubmitting && <span className={styles.spinner} aria-hidden="true" />}
            {t(isSubmitting ? 'login.submitting' : 'login.submit')}
          </button>
        </form>
      </section>
    </main>
  )
}

export default StaffLoginPage
