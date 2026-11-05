import { Link, NavLink, Outlet } from 'react-router'
import Icon from '../Icon/Icon.jsx'
import LanguagePill from '../LanguagePill/LanguagePill.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import useList from '../../hooks/useList.js'
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
    icon: 'bookmark',
    showsListCount: true
  },
  { 
    to: '/info', 
    label: 'nav.info', 
    icon: 'map' 
  },
]

const PublicLayout = () => {
  const { t } = useLanguage()
  const { count: listCount } = useList()

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link to="/menu" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">C</span>
          <span className={styles.brandText}>
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
        {bottomLinks.map((link) => {
          const badge = link.showsListCount ? listCount : 0

          return (
            <NavLink key={link.to} to={link.to} className={styles.bottomLink}>
              <span className={styles.iconWrap}>
                <Icon name={link.icon} size={22} />
                {badge > 0 && <span className={styles.badge} aria-hidden="true">{badge}</span>}
              </span>
              <span>{t(link.label)}</span>
              {badge > 0 && (
                <span className="visually-hidden">
                  {' '}({badge === 1 ? t('list.countOne') : t('list.count', { count: badge })})
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}

export default PublicLayout
