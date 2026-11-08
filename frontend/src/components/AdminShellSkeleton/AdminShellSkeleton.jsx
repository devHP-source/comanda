import LoadingState from '../LoadingState/LoadingState.jsx'
import Skeleton from '../Skeleton/Skeleton.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import layoutStyles from '../AdminLayout/AdminLayout.module.css' // the real layout's classes: same sizes at every breakpoint, nothing jumps
import styles from './AdminShellSkeleton.module.css'

const NAV_ROWS = 5

const shell = (t) => (body) => ( // Sidebar and header of AdminLayout. The content column waits for the page's own skeleton
  <div className={layoutStyles.shell}>
    <aside className={layoutStyles.sidebar}>
      <div className={layoutStyles.brand}>
        <span className={layoutStyles.brandMark} aria-hidden="true">C</span>
        <div>
          <p className={layoutStyles.brandName}>Comanda</p>
          <p className={layoutStyles.brandArea}>{t('admin.area')}</p>
        </div>
      </div>

      <div className={layoutStyles.navWrap} inert> {/* inert: no hover on placeholder rows */}
        <div className={`${layoutStyles.nav} hide-scrollbar`}>
          {Array.from({ length: NAV_ROWS }, (_, index) => (
            <div key={index} className={layoutStyles.navItem}>
              <Skeleton width="1.25rem" height="1.25rem" radius="var(--radius-round)" />
              <Skeleton width="5.5rem" height="0.9rem" />
            </div>
          ))}
        </div>
      </div>

      <div className={layoutStyles.profile}>
        <Skeleton width="2.25rem" height="2.25rem" radius="var(--radius-round)" className={styles.avatar} />
        <span className={layoutStyles.profileText}>
          <Skeleton width="7rem" height="0.95rem" />
          <Skeleton width="4rem" height="0.75rem" className={styles.profileRole} />
        </span>
        <div className={styles.logout}>
          <Skeleton height="var(--tap-min)" radius="var(--radius-pill)" />
        </div>
      </div>
    </aside>

    <div className={layoutStyles.main}>
      <header className={layoutStyles.header}>
        <div>
          <Skeleton width="10rem" height="1.25rem" />
          <Skeleton width="13rem" height="2rem" className={layoutStyles.greeting} />
        </div>
        <div className={layoutStyles.headerActions}>
          <Skeleton width="var(--tap-min)" height="var(--tap-min)" radius="var(--radius-round)" className={styles.fixed} />
          <Skeleton width="3.5rem" height="var(--tap-min)" radius="var(--radius-pill)" className={styles.fixed} />
        </div>
      </header>

      <main className={layoutStyles.content}>{body}</main>
    </div>
  </div>
)

const AdminShellSkeleton = () => { // Session check on an /admin page (Render can take 30–60 s to wake up)
  const { t } = useLanguage()

  return <LoadingState slowMessage="auth.checkingSlow" shell={shell(t)} />
}

export default AdminShellSkeleton
