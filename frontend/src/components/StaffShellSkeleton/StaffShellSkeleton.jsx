import { useLocation } from 'react-router'
import LoadingState from '../LoadingState/LoadingState.jsx'
import Skeleton from '../Skeleton/Skeleton.jsx'
import kitchenStyles from '../../pages/kitchen/KitchenPage/KitchenPage.module.css'
import ticketStyles from '../../pages/waiter/NewTicketPage/NewTicketPage.module.css'
import waiterStyles from '../../pages/waiter/WaiterPage/WaiterPage.module.css'
import layoutStyles from '../StaffLayout/StaffLayout.module.css' // the real screens' classes: same sizes at every breakpoint, nothing jumps
import styles from './StaffShellSkeleton.module.css'

// Fewer blocks than the pages' own skeletons: the slow line under them has to stay on a phone's screen
const WAITER_TILES = 3
const TICKET_ROWS = 4
const KITCHEN_COLUMNS = 3

const availabilityButton = <Skeleton width="9rem" height="var(--tap-min)" radius="var(--radius-pill)" className={styles.fixed} />

const WaiterBlocks = () => (
  <div>
    <div className={waiterStyles.header}>
      <div className={styles.waiterText}>
        <Skeleton width="min(11rem, 100%)" height="1.6rem" />
        <Skeleton width="min(9rem, 100%)" height="1rem" className={waiterStyles.service} />
      </div>
      {availabilityButton}
    </div>

    <div className={waiterStyles.layout}>
      <Skeleton height="11rem" radius="var(--radius-card)" />
      <div className={waiterStyles.grid}>
        {Array.from({ length: WAITER_TILES }, (_, index) => (
          <Skeleton key={index} height="6rem" radius="var(--radius-lg)" />
        ))}
      </div>
    </div>
  </div>
)

const NewTicketBlocks = () => (
  <div>
    <div className={ticketStyles.back}>
      <Skeleton width="9rem" height="1rem" />
    </div>

    <div className={ticketStyles.skeleton}>
      <Skeleton width="60%" height="2rem" />
      <Skeleton height="3rem" radius="var(--radius-md)" />
      {Array.from({ length: TICKET_ROWS }, (_, index) => (
        <Skeleton key={index} height="4rem" radius="var(--radius-lg)" />
      ))}
    </div>
  </div>
)

const KitchenBlocks = () => (
  <div>
    <div className={kitchenStyles.header}>
      <div className={styles.kitchenText}>
        <Skeleton width="min(11rem, 100%)" height="1.8rem" />
        <Skeleton width="min(14rem, 100%)" height="1rem" className={kitchenStyles.service} />
      </div>
      {availabilityButton}
    </div>

    <div className={kitchenStyles.board}>
      {Array.from({ length: KITCHEN_COLUMNS }, (_, index) => (
        <div key={index} className={`${kitchenStyles.column} ${kitchenStyles.loadingColumn} ${index === 0 ? kitchenStyles.active : ''}`}>
          <Skeleton height="15rem" radius="var(--radius-lg)" />
        </div>
      ))}
    </div>
  </div>
)

const screenFor = (pathname) => {
  if (pathname.startsWith('/staff/kitchen')) return { pageClass: kitchenStyles.page, blocks: <KitchenBlocks /> }
  if (pathname.includes('/tables/')) return { pageClass: ticketStyles.page, blocks: <NewTicketBlocks /> }
  return { pageClass: waiterStyles.page, blocks: <WaiterBlocks /> }
}

const StaffShellSkeleton = () => { // Session check on a waiter or kitchen page (Render can take 30–60 s to wake up): the staff bar + that screen's blocks
  const { pathname } = useLocation()
  const { pageClass, blocks } = screenFor(pathname)

  const shell = (body) => (
    <div className={layoutStyles.shell}>
      <header className={layoutStyles.bar}>
        <div className={layoutStyles.brand}>
          <span className={layoutStyles.brandMark} aria-hidden="true">C</span>
          <span className={layoutStyles.brandName}>Comanda</span>
        </div>

        <div className={layoutStyles.account}>
          <div className={styles.user}>
            <Skeleton height="0.95rem" />
            <Skeleton width="4rem" height="0.75rem" />
          </div>
          <Skeleton width="var(--tap-min)" height="var(--tap-min)" radius="var(--radius-round)" className={styles.fixed} />
          <Skeleton width="3.5rem" height="var(--tap-min)" radius="var(--radius-pill)" className={styles.fixed} />
          <Skeleton width="4.5rem" height="var(--tap-min)" radius="var(--radius-pill)" className={styles.fixed} />
        </div>
      </header>

      <main>
        <div className={pageClass}>{body}</div>
      </main>
    </div>
  )

  return <LoadingState slowMessage="auth.checkingSlow" shell={shell}>{blocks}</LoadingState>
}

export default StaffShellSkeleton
