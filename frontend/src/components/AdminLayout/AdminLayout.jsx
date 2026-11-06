import { NavLink, Outlet, useNavigate } from 'react-router'
import Icon from '../Icon/Icon.jsx'
import LanguagePill from '../LanguagePill/LanguagePill.jsx'
import useAuth from '../../hooks/useAuth.js'
import useLanguage from '../../hooks/useLanguage.js'
import { romeNow } from '../../utils/kitchenStatus.js'
import styles from './AdminLayout.module.css'

const NAV_ITEMS = [ // one entry per admin screen, added when that screen exists
  { to: '/admin/dishes', label: 'admin.nav.dishes', icon: 'dish' },
]

const LOCALES = { it: 'it-IT', en: 'en-GB' }

const todayLabel = (lang) => { // "Venerdì 6 novembre", on the restaurant's clock
  const text = new Intl.DateTimeFormat(LOCALES[lang], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Rome',
  }).format(new Date())
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const initials = (name) => name
  .split(' ')
  .filter(Boolean)
  .slice(0, 2)
  .map((word) => word[0].toUpperCase())
  .join('')

// Admin screens (desktop first): sidebar with the sections + profile, header with date and greeting. Phones and tablets: the sidebar becomes a top block
const AdminLayout = () => {
  const { t, lang } = useLanguage()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/staff/login', { replace: true })
  }

  const greeting = romeNow().time < '14:00' ? 'morning' : 'evening' // same rule as the waiter screen

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">C</span>
          <div>
            <p className={styles.brandName}>Comanda</p>
            <p className={styles.brandArea}>{t('admin.area')}</p>
          </div>
        </div>

        <nav className={styles.navWrap} aria-label={t('admin.navLabel')}>
          <ul className={`${styles.nav} hide-scrollbar`}>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                >
                  <Icon name={item.icon} size={20} />
                  {t(item.label)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.profile}>
          <span className={styles.avatar} aria-hidden="true">{initials(user.name)}</span>
          <span className={styles.profileText}>
            <span className={styles.profileName}>{user.name}</span>
            <span className={styles.profileRole}>{t(`staff.roles.${user.role}`)}</span>
          </span>
          <button type="button" className={styles.logout} onClick={handleLogout}>
            {t('staff.logout')}
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <div>
            <p className={styles.date}>{todayLabel(lang)}</p>
            <p className={styles.greeting}>{t(`admin.greeting.${greeting}`, { name: user.name.split(' ')[0] })}</p>
          </div>
          <div className={styles.headerActions}>
            <LanguagePill />
          </div>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
