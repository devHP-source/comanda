import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import Icon from '../Icon/Icon.jsx'
import LanguagePill from '../LanguagePill/LanguagePill.jsx'
import ReadyBell from '../ReadyBell/ReadyBell.jsx'
import ViewAsSwitcher from '../ViewAsSwitcher/ViewAsSwitcher.jsx'
import useAuth from '../../hooks/useAuth.js'
import useLanguage from '../../hooks/useLanguage.js'
import { capitalize, formatWeekdayDate } from '../../utils/calendar.js'
import greetingKey from '../../utils/greeting.js'
import initials from '../../utils/initials.js'
import { romeNow } from '../../utils/restaurantClock.js'
import styles from './AdminLayout.module.css'

const NAV_ITEMS = [ // one entry per admin screen. `end`: /admin is active only on itself, not on /admin/dishes
  { to: '/admin', label: 'admin.nav.dashboard', icon: 'dashboard', end: true },
  { to: '/admin/dishes', label: 'admin.nav.dishes', icon: 'dish' },
  { to: '/admin/categories', label: 'admin.nav.categories', icon: 'list' },
  { to: '/admin/reservations', label: 'admin.nav.reservations', icon: 'calendar' },
  { to: '/admin/qr', label: 'admin.nav.qr', icon: 'qr' },
  { to: '/admin/staff', label: 'admin.nav.staff', icon: 'people' },
  { to: '/admin/settings', label: 'admin.nav.settings', icon: 'settings' },
]

const AdminLayout = () => { // Admin screens (desktop first): sidebar with the sections + profile, header with date and greeting. Phones and tablets: the sidebar becomes a top block
  const { t, lang } = useLanguage()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const stripRef = useRef(null)

  useEffect(() => { // Phones and tablets: keeps the active tab centered in the strip (only the strip moves, never the page), as the menu's category chips
    const strip = stripRef.current
    const tab = strip.querySelector('[aria-current="page"]')
    if (!tab) return
    strip.scrollTo({ left: tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2 })
  }, [pathname])

  useEffect(() => { // Fade on the right edge only while more tabs are hidden there. Labels change width with the language
    const strip = stripRef.current
    const updateFade = () => {
      const lastTab = strip.lastElementChild
      const hasMore = lastTab.offsetLeft + lastTab.offsetWidth > strip.scrollLeft + strip.clientWidth + 1 // +1: rounding
      strip.classList.toggle(styles.navFade, hasMore)
    }

    updateFade()
    strip.addEventListener('scroll', updateFade, { passive: true })
    window.addEventListener('resize', updateFade)
    return () => {
      strip.removeEventListener('scroll', updateFade)
      window.removeEventListener('resize', updateFade)
    }
  }, [lang])

  const handleLogout = () => {
    logout()
    navigate('/staff/login', { replace: true })
  }

  const now = romeNow()
  const greeting = greetingKey(now.time, lang) // same helper as the waiter screen
  const today = capitalize(formatWeekdayDate(now.date, lang)) // "Venerdì 6 novembre", on the restaurant's clock

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
          <ul ref={stripRef} className={`${styles.nav} hide-scrollbar`}>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
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
            <p className={styles.date}>{today}</p>
            <p className={styles.greeting}>{t(`admin.greeting.${greeting}`, { name: user.name.split(' ')[0] })}</p>
          </div>
          <div className={styles.headerActions}>
            <ViewAsSwitcher />
            <ReadyBell />
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
