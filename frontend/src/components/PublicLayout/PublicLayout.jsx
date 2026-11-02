import { Link, NavLink, Outlet } from 'react-router'
import Icon from '../Icon/Icon.jsx'
import LanguagePill from '../LanguagePill/LanguagePill.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import styles from './PublicLayout.module.css'

const topLinks = [ // Home and Prenota join both bars when their pages exist
  { 
    to: '/menu', 
    label: 'nav.menu' 
  },
  { 
    to: '/info', 
    label: 'nav.about' 
  },
]

const bottomLinks = [
  { 
    to: '/menu', 
    label: 'nav.menu', 
    icon: 'menu' 
  },
  { 
    to: '/list', 
    label: 'nav.list', 
    icon: 'bookmark' 
  },
  { 
    to: '/info', 
    label: 'nav.info', 
    icon: 'map' 
  },
]

const PublicLayout = () => {
  const { t } = useLanguage()

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link to="/menu" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">C</span>
          <span>
            <span className={styles.brandName}>Comanda</span>
            <span className={styles.brandNote}>{t('brand.note')}</span>
          </span>
        </Link>

        <nav className={styles.topNav} aria-label={t('nav.main')}>
          {topLinks.map((link) => (
            <NavLink key={link.to} to={link.to} className={styles.topLink}>
              {t(link.label)}
            </NavLink>
          ))}
        </nav>

        <LanguagePill />
      </header>

      <main>
        <Outlet />
      </main>

      <nav className={styles.bottomNav} aria-label={t('nav.mobile')}>
        {bottomLinks.map((link) => (
          <NavLink key={link.to} to={link.to} className={styles.bottomLink}>
            <Icon name={link.icon} size={22} />
            <span>{t(link.label)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default PublicLayout
