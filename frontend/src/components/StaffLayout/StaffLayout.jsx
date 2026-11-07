import { Outlet, useNavigate } from 'react-router'
import LanguagePill from '../LanguagePill/LanguagePill.jsx'
import ReadyBell from '../ReadyBell/ReadyBell.jsx'
import useAuth from '../../hooks/useAuth.js'
import useLanguage from '../../hooks/useLanguage.js'
import styles from './StaffLayout.module.css'


const StaffLayout = () => { // Slim bar shared by every staff screen whose logged in + logout
  const { t } = useLanguage()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/staff/login', { replace: true })
  }
// Each screen still draws its own header below it (waiter greeting, kitchen counters)
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">C</span>
          <span className={styles.brandName}>Comanda</span>
        </div>

        <div className={styles.account}>
          <span className={styles.user}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userRole}>{t(`staff.roles.${user.role}`)}</span>
          </span>
          <ReadyBell />
          <LanguagePill />
          <button type="button" className={styles.logout} onClick={handleLogout}>
            {t('staff.logout')}
          </button>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  )
}

export default StaffLayout
